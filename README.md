# New Athlete Badminton School

ระบบบริหารโรงเรียนแบดมินตันด้วย `Next.js 14`, `TypeScript`, `TailwindCSS` และ `Supabase`

## Tech Stack

- Frontend: `Next.js 14`, `React 18`, `TypeScript`
- UI: `TailwindCSS`, `shadcn/ui`, `Lucide React`
- Backend: `Supabase` (`Auth`, `PostgreSQL`, `Storage`, `RLS`)
- Deployment: `Vercel`

## Run Project Locally

1. ติดตั้ง dependencies

```bash
npm install
```

2. สร้างไฟล์ environment เช่น `.env.local`

ใส่ค่าที่โปรเจกต์ใช้งาน:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SLIPOK_API_URL=
SLIPOK_API_KEY=
SLIPOK_TEST_MODE=
```

3. รัน development server

```bash
npm run dev
```

4. เปิด `http://localhost:3000`

## ย้ายไปพัฒนาอีกเครื่อง

ถ้าต้องการสลับไปทำงานเครื่องใหม่ ให้ทำตามลำดับนี้ทุกครั้ง:

1. Clone repository นี้
2. รัน `npm install`
3. คัดลอกค่า environment ของโปรเจกต์มาใส่ใน `.env.local`
4. ตั้งค่า Windsurf `MCP` สำหรับ Supabase
5. ติดตั้ง `Supabase agent skills`
6. Restart Windsurf ถ้ายังไม่เห็น MCP หรือ skill ใหม่

## Configure Supabase MCP in Windsurf

ต้องใช้ Windsurf เวอร์ชัน `0.1.37` ขึ้นไป

สร้างหรือแก้ไขไฟล์ `~/.codeium/windsurf/mcp_config.json` บนเครื่องที่กำลังใช้งาน

ถ้ามี MCP ตัวอื่นอยู่แล้ว ให้ merge เฉพาะ `supabase` entry เข้าไป ไม่ต้องลบของเดิม

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.supabase.com/mcp?project_ref=tvnhholicwjtxdhlxfqs&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cbranching%2Cfunctions%2Cdevelopment%2Cstorage"
      ]
    }
  }
}
```

หมายเหตุ: Windsurf ยังไม่รองรับ remote MCP ผ่าน HTTP transport โดยตรง จึงต้องใช้ `mcp-remote` เป็น proxy

## Install Supabase Agent Skills

รันคำสั่งนี้จาก root ของโปรเจกต์:

```bash
npx skills add supabase/agent-skills
```

บนเครื่องนี้คำสั่งดังกล่าวติดตั้ง skill ไว้ใต้ `.agents/skills` ของ repository นี้

ตัวอย่างที่ติดตั้งสำเร็จแล้วในโปรเจกต์นี้คือ:

`/.agents/skills/supabase-postgres-best-practices`

ดังนั้นเวลา setup เครื่องใหม่ ให้ตรวจว่ามี skill ถูกเพิ่มเข้ามาใน `.agents/skills` หลังรันคำสั่งเรียบร้อยแล้ว

## Windsurf Workflow in This Repo

มี workflow สำหรับ setup นี้อยู่ที่:

`/.windsurf/workflows/setup-supabase-mcp.md`

ใช้เมื่อย้ายเครื่องหรือเมื่อเครื่องนั้นยังไม่ได้ตั้งค่า Supabase MCP

## GitHub Pages

โปรเจกต์นี้ถูกเตรียมให้ deploy หน้า `public/static` ขึ้น GitHub Pages ได้แล้ว โดยใช้ไฟล์ในโฟลเดอร์ `docs/`

ไฟล์ที่เกี่ยวข้อง:

- `docs/index.html` สำหรับหน้า public ของโปรเจกต์
- `docs/404.html` สำหรับ redirect กลับหน้าแรก
- `docs/.nojekyll` เพื่อหลีกเลี่ยงปัญหา asset processing ของ GitHub Pages
- `.github/workflows/deploy-github-pages.yml` สำหรับ deploy อัตโนมัติผ่าน GitHub Actions

### วิธีเปิดใช้งาน

1. Push ขึ้น branch `main`
2. ไปที่ GitHub repository settings
3. เปิด `Pages`
4. ตั้งค่า source เป็น `GitHub Actions`
5. หลัง workflow รันเสร็จ หน้าเว็บจะพร้อมใช้งานบนโดเมน GitHub Pages ของ repository นี้

### ข้อจำกัดสำคัญ

GitHub Pages เป็น static hosting ดังนั้นตอนนี้รองรับเฉพาะหน้า public/static เท่านั้น

ส่วนของระบบเต็มยังไม่สามารถย้ายไป GitHub Pages ได้ตรง ๆ เพราะโปรเจกต์มี:

- `middleware`
- `auth callback route`
- `app/api/*` route handlers
- server-side Supabase client ที่อาศัย cookies และ session
- หน้า dashboard/admin/coach ที่ต้องพึ่ง server runtime

ดังนั้นแนวทางที่เหมาะตอนนี้คือ:

- ใช้ GitHub Pages เป็นหน้า public/landing page
- ใช้ Vercel หรือโฮสต์ที่รองรับ Next.js runtime สำหรับแอปจริง

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` เป็น secret ห้าม push ลง repository
- ถ้าจะใช้ SlipOK จริง ต้องใส่ `SLIPOK_API_URL` และ `SLIPOK_API_KEY`
- ถ้าต้องการ bypass การตรวจสลิประหว่างทดสอบ ให้กำหนด `SLIPOK_TEST_MODE=true`
- ไฟล์ `~/.codeium/windsurf/mcp_config.json` เป็นการตั้งค่าระดับเครื่อง ต้องทำซ้ำทุกเครื่องที่ใช้พัฒนา

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```
