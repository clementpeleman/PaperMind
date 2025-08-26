# PaperMind

https://github.com/clementpeleman/PaperMind/assets/demo.mp4

<p align="center">
  <video src="/public/demo.gif" controls width="600"></video>
</p>

<p align="center">
  <img src="/public/Zotero.png" alt="Zotero Library" width="600"/>
</p>

---

PaperMind is een modern webapplicatie ontworpen om gebruikers te helpen academische papers en onderzoeksdata te beheren, analyseren en ermee te interageren. Gebouwd met **Next.js** en **TypeScript**, integreert het met **Supabase** en **Zotero** om een naadloze ervaring te bieden voor onderzoekers en kenniswerkers.

## Features

- **AI-Powered Analysis:** Genereer inzichten en samenvattingen uit je papers met geïntegreerde AI-modellen.
- **Zotero Integration:** Koppel je Zotero-bibliotheek om referenties te importeren en beheren.
- **Supabase Auth & Storage:** Veilige authenticatie en cloudopslag voor je data.
- **Customizable Dashboards:** Visualiseer gebruikersgroei, paperstatistieken en meer.
- **SQL Editor:** Voer en beheer aangepaste queries uit op je onderzoeksdata.
- **Dynamic Forms & Tables:** Flexibele UI-componenten voor beheer en weergave van informatie.

## Project Structure

- `app/` – Next.js app directory, inclusief API-routes en pagina’s  
- `components/` – Herbruikbare React-componenten en UI-elementen  
- `contexts/` – React context providers voor state management  
- `hooks/` – Custom React hooks voor datafetching en logica  
- `lib/` – Utility-functies en API-integraties  
- `supabase/` – Databaseschema en migratiescripts  

## Getting Started

1. **Clone de repository:**
   ```bash
   git clone https://github.com/clementpeleman/PaperMind.git
   cd PaperMind
   ````

2. **Installeer dependencies:**

   ```bash
   npm install
   ```
3. **Configureer environment variables:**

   * Kopieer `.env.example` naar `.env.local` en vul je Supabase- en Zotero-credentials in.
4. **Start de development server:**

   ```bash
   npm run dev
   ```
5. **Open de app:**

   * Ga naar [http://localhost:3000](http://localhost:3000) in je browser.

## Integraties

* **Supabase:** Voor authenticatie, database en opslag.
* **Zotero:** Synchroniseert je onderzoekslibrary en referenties.
* **OpenAI of andere LLMs:** Voor AI-functionaliteiten (configureerbaar).

## Scripts

* `npm run dev` – Start de development server
* `npm run build` – Build de app voor productie
* `npm start` – Start de productie server

## Contributing

Bijdragen zijn welkom! Open gerust issues of dien pull requests in voor verbeteringen en bugfixes.

## License

Dit project is gelicentieerd onder de MIT License.

```

👉 Let wel: GitHub ondersteunt geen inline `<video>`-tag in Markdown rendering. Je kan dus best een **link** of een **animated gif** gebruiken in je README.  
Wil je dat ik de video ook omzet naar een **GIF-preview** die automatisch afspeelt in de README?
```
