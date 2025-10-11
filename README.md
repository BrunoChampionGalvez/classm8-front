## ClassM8 — Frontend (Next.js)

Interfaz web para subir audios de reuniones o clases universitarias y generar resúmenes didácticos. Los resúmenes se muestran en la UI con formato tipo markdown (títulos, subtítulos, listas, negritas, etc.) y pueden exportarse a DOCX.

Estado del proyecto: no está desplegado públicamente. Se puede ejecutar localmente junto con el backend.

## Tech stack

- Next.js
- Tailwind CSS v4
- NestJS (backend API)
- PostgreSQL (planeado para persistencia futura)
- OpenAI

## Requisitos

- Node.js LTS y npm
- Repositorio del Backend: https://github.com/BrunoChampionGalvez/classm8-back

## Configuración rápida

1) Crea un archivo `.env.local` en la carpeta `front/` con:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

2) Instala dependencias y levanta el servidor de desarrollo en el puerto 3001:

```bash
npm install
npm run dev
```

3) Asegúrate de tener el backend ejecutándose en paralelo en el puerto 3000. La UI estará disponible en http://localhost:3001.

## Uso

1) Regístrate o inicia sesión para obtener un token JWT.
2) Sube un archivo de audio (m4a, wav, mp3, aac, caf, ogg). Si es muy grande, el backend intentará particionarlo con ffmpeg/ffprobe.
3) Visualiza el resumen generado y utiliza el botón para exportar a DOCX.

## Scripts

- Desarrollo: `npm run dev`
- Build: `npm run build`
- Producción: `npm start`
- Lint: `npm run lint`

## Notas

- Este proyecto está pensado para ejecutarse localmente junto con el backend. No hay despliegue público por ahora.
- Cambia `NEXT_PUBLIC_API_URL` si el backend corre en otra URL/puerto.
