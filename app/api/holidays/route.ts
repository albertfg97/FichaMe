import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://calendariosnacionales.com/es';
const FESTIVE_YEARS = ['2026', '2027'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const ccaa = searchParams.get('ccaa');
  const provincia = searchParams.get('provincia');
  const municipio = searchParams.get('municipio');

  let urls: string[] = [];
  if (type === 'comunidades') {
    urls = [`${BASE}/v1/2026/comunidades.json`];
  } else if (type === 'provincias' && ccaa) {
    urls = [`${BASE}/v1/2026/regiones/${ccaa}/provincias.json`];
  } else if (type === 'localidades' && ccaa && provincia) {
    urls = [`${BASE}/v1/2026/regiones/${ccaa}/provincias/${provincia}/localidades.json`];
  } else if (type === 'festivos' && ccaa && provincia && municipio) {
    urls = FESTIVE_YEARS.map(
      (y) => `${BASE}/v1/${y}/localidades/${ccaa}/${provincia}/${municipio}.json`
    );
  } else {
    return NextResponse.json({ error: 'Parámetros no válidos' }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      urls.map(async (u) => {
        const res = await fetch(u, { next: { revalidate: 86400 } });
        if (!res.ok) throw new Error(`HTTP ${res.status} en ${u}`);
        return res.json();
      })
    );

    if (type === 'festivos') {
      const list = results.flatMap((r) => (r?.holidays?.calendar as unknown[]) ?? []);
      return NextResponse.json({ holidays: list, source: 'https://calendariosnacionales.com' });
    }

    const data = results[0];
    const arr = Array.isArray(data)
      ? data
      : Object.values(data as Record<string, unknown>).find((v) => Array.isArray(v)) ?? [];
    return NextResponse.json({ items: arr });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error consultando festivos' },
      { status: 502 }
    );
  }
}