"use client";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";
import type { DrawShape } from "./MapView";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

export default function DrawControl({
  onCreate,
  request,
  proposalMode,
}: {
  onCreate: (g: Geometry) => void;
  request?: { shape: DrawShape; nonce: number };
  proposalMode?: boolean;
}) {
  const map = useMap();
  const cb = useRef(onCreate);
  useEffect(() => {
    cb.current = onCreate;
  }, [onCreate]);

  useEffect(() => {
    L.PM.reInitLayer(map as unknown as L.Layer);
    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircle: false,
      drawText: false,
      drawCircleMarker: true,
      drawPolyline: !proposalMode,
      drawPolygon: true,
      drawRectangle: true,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
      rotateMode: false,
    });
    try {
      map.pm.setLang("ro");
    } catch {
      /* language pack missing – keep English */
    }
    map.pm.setGlobalOptions({
      templineStyle: { color: "#f07400" },
      hintlineStyle: { color: "#f07400", dashArray: "5,5" },
      pathOptions: { color: "#f07400" },
    });

    const handler = (e: { layer: L.Layer }) => {
      const gj = (e.layer as L.Polyline).toGeoJSON() as Feature;
      map.removeLayer(e.layer);
      cb.current(gj.geometry);
    };
    map.on("pm:create", handler);
    return () => {
      map.off("pm:create", handler);
      map.pm.disableDraw();
      map.pm.removeControls();
    };
  }, [map, proposalMode]);

  useEffect(() => {
    if (request) map.pm.enableDraw(request.shape, { continueDrawing: false });
  }, [map, request]);

  return null;
}
