# PaperMind

PaperMind is a modern web application designed to help users manage, analyze, and interact with academic papers and research data. Built with Next.js and TypeScript, it integrates with Supabase and Zotero to provide a seamless experience for researchers and knowledge workers.

## Features

- **AI-Powered Analysis:** Generate insights and summaries from your papers using integrated AI models.
- **Zotero Integration:** Connect your Zotero library to import and manage references.
- **Supabase Auth & Storage:** Secure authentication and cloud storage for your data.
- **Customizable Dashboards:** Visualize user growth, paper statistics, and more.
- **SQL Editor:** Run and manage custom queries on your research data.
- **Dynamic Forms & Tables:** Flexible UI components for managing and displaying information.

## Project Structure

- `app/` – Next.js app directory, including API routes and pages
- `components/` – Reusable React components and UI elements
- `contexts/` – React context providers for state management
- `hooks/` – Custom React hooks for data fetching and logic
- `lib/` – Utility functions and API integrations
- `supabase/` – Database schema and migration scripts

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/clementpeleman/PaperMind.git
   cd PaperMind
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   - Copy `.env.example` to `.env.local` and fill in your Supabase and Zotero credentials.
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. **Open the app:**
   - Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Integrations

- **Supabase:** Used for authentication, database, and storage.
- **Zotero:** Syncs your research library and references.
- **OpenAI or other LLMs:** For AI-powered features (configurable).

## Scripts

- `npm run dev` – Start the development server
- `npm run build` – Build the app for production
- `npm start` – Start the production server

## Contributing

Contributions are welcome! Please open issues or submit pull requests for improvements and bug fixes.

## License

This project is licensed under the MIT License.