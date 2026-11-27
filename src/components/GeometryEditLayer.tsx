"use client";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
export interface GeometryEditRequest {
  id: string;
  geometry: Geometry;
  nonce: number;
}
export default function GeometryEditLayer({
  request,
  onChange,
}: {
  request: GeometryEditRequest;
  onChange: (g: Geometry) => void;
}) {
  const map = useMap();
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    map.pm.disableDraw();
    const group = L.geoJSON(
      {
        type: "Feature",
        properties: {},
        geometry: request.geometry,
      } as Feature,
      {
        style: { color: "#107c70", weight: 3, fillOpacity: 0.18 },
        pointToLayer: (_feature, latlng) =>
          L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({
              className: "geometry-edit-marker",
              html: "<span></span>",
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            }),
          }),
      },
    ).addTo(map);
    const change = () => {
      const fc = group.toGeoJSON() as FeatureCollection;
      const g = fc.features[0]?.geometry;
      if (g) callback.current(g);
    };
    const enable = (layer: L.Layer) => {
      if (layer instanceof L.LayerGroup) {
        layer.eachLayer(enable);
        return;
      }
      if (layer instanceof L.Marker) {
        layer.on("dragend", change);
        return;
      }
      if (layer instanceof L.Polyline) {
        layer.pm.enable({ allowSelfIntersection: false });
        layer.on("pm:edit", change);
      }
    };
    group.eachLayer(enable);
    return () => {
      group.eachLayer(function disable(layer) {
        if (layer instanceof L.LayerGroup) layer.eachLayer(disable);
        else if (layer instanceof L.Polyline) layer.pm.disable();
        layer.off("pm:edit", change);
        layer.off("dragend", change);
      });
      group.remove();
    };
  }, [map, request]);
  return null;
}
