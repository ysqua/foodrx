import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="Personalized grocery plans powered by real CDC + USDA data for your ZIP code." />
        <meta property="og:title" content="FoodRx — Eat for your ZIP code" />
        <meta property="og:description" content="Your community's real chronic disease risk profile, turned into a personalized grocery plan." />
        <meta property="og:type" content="website" />
        <meta name="theme-color" content="#1D9E75" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
