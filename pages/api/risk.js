/**
 * /api/risk?zip=33101
 *
 * Server-side route that:
 * 1. Calls Census Geocoder to resolve ZIP → county name
 * 2. Calls CDC PLACES API (data.cdc.gov) for real ZCTA-level health data
 * 3. Returns a clean risk profile JSON — API key never exposed to browser
 */

// National averages from CDC PLACES 2024 national estimates
const NATIONAL_AVG = {
  diabetes:     9.3,
  hypertension: 32.0,
  obesity:      33.9,
  heartDisease:  5.5,
};

async function fetchCensusCounty(zip) {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/address?street=1+Main+St&zip=${zip}&benchmark=Public_AR_Current&vintage=Current_Current&layers=86&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
    const data = await res.json();

    const matches = data?.result?.addressMatches;
    if (!matches || matches.length === 0) return null;

    const geo = matches[0].geographies;
    const counties = geo?.["Counties"] || geo?.["2020 Census Counties"];
    if (!counties || counties.length === 0) return null;

    return {
      countyName: counties[0].BASENAME,
      stateCode:  counties[0].STATE,
    };
  } catch {
    return null;
  }
}

// US state FIPS → abbreviation map for display
const STATE_FIPS = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
};

async function fetchCDCPlaces(zip) {
  const appToken = process.env.CDC_APP_TOKEN || "";
  const headers = appToken ? { "X-App-Token": appToken } : {};

  // CDC PLACES 2024 ZCTA dataset — dataset ID: qnzd-25i4
  const measures = [
    { id: "DIABETES", key: "diabetes" },
    { id: "BPHIGH",   key: "hypertension" },
    { id: "OBESITY",  key: "obesity" },
    { id: "CHD",      key: "heartDisease" },
  ];

  const results = {};
  let locationName = null;

  await Promise.all(
    measures.map(async ({ id, key }) => {
      try {
        const url = `https://data.cdc.gov/resource/qnzd-25i4.json?measureid=${id}&locationname=${zip}&$limit=10`;
        const res = await fetch(url, { headers, next: { revalidate: 3600 } });
        const rows = await res.json();

        if (!Array.isArray(rows) || rows.length === 0) return;

        // Prefer "Overall" stratification; fall back to first row
        const row = rows.find(r =>
          !r.stratificationcategory1 ||
          r.stratificationcategory1 === "Overall" ||
          r.stratificationcategory1 === "Total"
        ) || rows[0];

        const val = parseFloat(row.data_value);
        if (!isNaN(val)) {
          results[key] = val;
          if (!locationName && row.locationname) locationName = row.locationname;
        }
      } catch {
        // silently skip — caller handles nulls
      }
    })
  );

  return { metrics: results, locationName };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { zip } = req.query;

  if (!zip || !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: "Valid 5-digit ZIP code required" });
  }

  try {
    // Fetch CDC + Census in parallel
    const [censusData, cdcData] = await Promise.all([
      fetchCensusCounty(zip),
      fetchCDCPlaces(zip),
    ]);

    const stateAbbr = censusData ? (STATE_FIPS[censusData.stateCode] || censusData.stateCode) : "";
    const countyName = censusData?.countyName || `ZIP ${zip}`;
    const city = stateAbbr ? `${countyName}, ${stateAbbr}` : countyName;

    // Fill nulls with national averages so UI never breaks
    const metrics = {
      diabetes:     cdcData.metrics.diabetes     ?? NATIONAL_AVG.diabetes,
      hypertension: cdcData.metrics.hypertension ?? NATIONAL_AVG.hypertension,
      obesity:      cdcData.metrics.obesity       ?? NATIONAL_AVG.obesity,
      heartDisease: cdcData.metrics.heartDisease  ?? NATIONAL_AVG.heartDisease,
    };

    const hasRealData = Object.values(cdcData.metrics).some(v => v !== null && v !== undefined);

    // Flag conditions >15% above national average
    const elevated = [];
    if (metrics.diabetes     > NATIONAL_AVG.diabetes     * 1.15) elevated.push("diabetes");
    if (metrics.hypertension > NATIONAL_AVG.hypertension * 1.15) elevated.push("hypertension");
    if (metrics.obesity      > NATIONAL_AVG.obesity      * 1.15) elevated.push("obesity");
    if (metrics.heartDisease > NATIONAL_AVG.heartDisease * 1.15) elevated.push("heart disease");

    return res.status(200).json({
      zip,
      city,
      countyName,
      stateAbbr,
      metrics,
      national: NATIONAL_AVG,
      elevated,
      hasRealData,
      dataSource: "CDC PLACES 2024 (BRFSS model estimates, ZCTA level)",
    });

  } catch (err) {
    console.error("Risk API error:", err);
    return res.status(500).json({ error: "Failed to fetch health data", detail: err.message });
  }
}
