# Data sources

Everything in `data/` is built by `scripts/build-area.ts` from public domain US government sources:

- FAA VFR raster charts (the Phoenix and Miami TACs and sectionals), aeronav.faa.gov. Cropped and reprojected.
- FAA IFR enroute raster charts (area charts A-01 Miami and A-02 Phoenix, low altitude sheets L-23 and L-05), aeronav.faa.gov. Cropped and reprojected.
- FAA airspace (Class_Airspace and Special_Use_Airspace) from the FAA's ADDS open data service.
- FAA CIFP (Coded Instrument Flight Procedures), aeronav.faa.gov.
- FAA d-TPP airport diagrams, aeronav.faa.gov. Placed on the map from their own latitude and longitude ticks.
- USGS 3DEP 1 arc-second elevation tiles.

None of it is for navigation. Procedures are drawn from the coded legs with simple assumptions (300 ft per NM climbs, corners for turns, radar vectors as straight lines); they are not flown profiles.

skycake uses three.js (MIT) in the browser, installed by the site as a peer dependency. SkyCake Viewer (`app/`) bundles three.js into `www/` with esbuild, which keeps three.js's license comment in the bundle. Build-time tools (pdf.js, geotiff.js, proj4, sharp, esbuild and others) are not shipped.

# Models

- "Small Airplane" by Vojtěch Balák, from poly.pizza, CC-BY 3.0, unchanged apart from scale and placement. Source https://poly.pizza/m/7cvx6ex-xfL; license https://creativecommons.org/licenses/by/3.0/. It ships as base64 in `src/plane.ts`.
