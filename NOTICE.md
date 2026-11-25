# Data sources

Everything in `data/` is built by `scripts/build-area.ts` from public domain US government sources:

- FAA VFR raster charts (sectionals and TACs for each area in `scripts/build-area.ts`), aeronav.faa.gov. Cropped, reprojected and, where an area spans two or three sectionals, joined at their edges.
- FAA IFR enroute raster charts (the A-01 and A-02 area charts and the low altitude sheets for each area), aeronav.faa.gov. Cropped, reprojected and joined the same way.
- FAA airspace (Class_Airspace, Special_Use_Airspace and Boundary_Airspace) from the FAA's ADDS open data service, US records only.
- FAA CIFP (Coded Instrument Flight Procedures), aeronav.faa.gov.
- FAA d-TPP airport diagrams, aeronav.faa.gov. Placed on the map from their own latitude and longitude ticks.
- FAA d-TPP approach, departure and arrival charts, aeronav.faa.gov. Rendered from the PDFs to greyscale images at build time and shown unchanged apart from turning sideways pages upright.
- USGS 3DEP 1 arc-second elevation tiles.
- Two areas in no airspace layer, drawn from their FAA definitions: the 60 NM ring around the DCA VOR/DME (14 CFR 91.161), centred on the VOR as the CIFP places it, and the Disneyland TFR, FDC NOTAM 6/6925 (tfr.faa.gov).

None of it is for navigation. Procedures are drawn from the coded legs with simple assumptions (300 ft per NM climbs, corners for turns, radar vectors as straight lines); they are not flown profiles.

skycake uses three.js (MIT) in the browser, installed by the site as a peer dependency. SkyCake Viewer (`app/`) bundles three.js into `www/` with esbuild, which keeps three.js's license comment in the bundle. Build-time tools (pdf.js, geotiff.js, proj4, sharp, esbuild and others) are not shipped.

# Models

- "Small Airplane" by Vojtěch Balák, from poly.pizza, CC-BY 3.0, unchanged apart from scale and placement. Source https://poly.pizza/m/7cvx6ex-xfL; license https://creativecommons.org/licenses/by/3.0/. It ships as base64 in `src/plane.ts`.
