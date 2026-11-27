"use client";
import { useEffect, useState } from "react";
export interface Classification {
  id: string;
  name: string;
  description: string;
  active: boolean;
  updated_at: string;
}
export function useClassifications() {
  const [items, setItems] = useState<Classification[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/classifications")
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        if (alive) setItems(data.filter((c: Classification) => c.active));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return items;
}
