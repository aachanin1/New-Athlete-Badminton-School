# SETUP_GUIDE.md - Setup Instructions for New Development Machine

This guide provides step-by-step instructions for setting up the New Athlete Badminton School project on a new machine.

---

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn** / **pnpm**
- **Git** - [Download here](https://git-scm.com/)
- **Code Editor**: VS Code, Windsurf, or Codex Desktop
- **Supabase Account** - [Sign up here](https://supabase.com/)

---

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd "New Athlete Badminton School"
```

---

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`.

---

## Step 3: Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in the required values:

   ### Supabase Configuration
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project (project ref: `tvnhholicwjtxdhlxfqs`)
   - Navigate to Settings → API
   - Copy the following values:
     - `NEXT_PUBLIC_SUPABASE_URL` - Project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - anon/public key
     - `SUPABASE_SERVICE_ROLE_KEY` - service_role key (SECRET - never share)

   ### SlipOK Configuration
   - Go to [SlipOK Dashboard](https://www.slipok.com/)
   - Get your API key and endpoint
   - Fill in:
     - `SLIPOK_API_URL` - API endpoint
     - `SLIPOK_API_KEY` - Your API key
     - `SLIPOK_TEST_MODE` - Set to `true` for development, `false` for production

3. Save `.env.local`

**Important**: `.env.local` is gitignored and should never be committed to the repository.

---

## Step 4: Apply Database Schema (if needed)

If this is a fresh Supabase project, you need to apply the database schema:

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new)
2. Open `supabase/schema.sql` from the repository
3. Copy and paste the entire content into the SQL Editor
4. Click "Run" to execute the schema

**Note**: If you're connecting to an existing Supabase project that already has the schema applied, you can skip this step.

---

## Step 5: Apply Phone Trigger (Required)

The phone number persistence trigger must be applied to ensure user phone numbers are saved during registration:

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new)
2. Open `supabase/fix-phone-trigger.sql` from the repository
3. Copy and paste the content into the SQL Editor
4. Click "Run" to execute the trigger

**Important**: This step is required for the registration flow to work correctly.

---

## Step 6: Set Up Supabase Storage Buckets

The project uses Supabase Storage for payment slips and coach check-in photos:

1. Go to [Supabase Storage](https://supabase.com/dashboard/project/_/storage)
2. Create the following buckets (if they don't exist):
   - `payment-slips` - Public bucket for payment slip images
   - `coach-checkins` - Private bucket for coach check-in photos

3. Alternatively, run `supabase/fix-storage.sql` in the SQL Editor to set up buckets automatically.

---

## Step 7: Configure Supabase MCP (for Windsurf/Codex)

If you're using Windsurf or Codex Desktop with Supabase MCP integration:

### 7.1 Install Supabase Agent Skills

Run this command from the project root:

```bash
npx skills add supabase/agent-skills
```

This will install Supabase-specific skills in `.agents/skills/`.

### 7.2 Configure MCP

1. Create or edit the MCP config file:
   - **Location**: `~/.codeium/windsurf/mcp_config.json` (Windsurf)
   - **Location**: Check Codex Desktop documentation for MCP config location

2. Add the following configuration:

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

**Note**: If you already have other MCP servers configured, merge the `supabase` entry into your existing config instead of replacing it.

3. Restart your IDE for the changes to take effect.

---

## Step 8: Run TypeScript Check

Verify that the code compiles without errors:

```bash
npx tsc --noEmit --skipLibCheck
```

Expected output: No errors (exit code 0).

If you see errors, check that:
- All environment variables are set in `.env.local`
- Dependencies are installed correctly
- You're using Node.js v18 or higher

---

## Step 9: Start Development Server

```bash
npm run dev
```

The application will start at `http://localhost:3000`.

---

## Step 10: Verify Setup

### 10.1 Check Landing Page
- Open `http://localhost:3000`
- You should see the public landing page

### 10.2 Test Registration
- Go to `http://localhost:3000/auth/register`
- Register a new user
- Verify that the user is created in Supabase Auth
- Verify that the profile is created in the `profiles` table
- Verify that the phone number is saved (if you applied the trigger)

### 10.3 Test Login
- Go to `http://localhost:3000/auth/login`
- Login with the registered user
- You should be redirected to `/dashboard`

### 10.4 Check Admin Access
- In Supabase, manually change a user's role to `admin` in the `profiles` table
- Login as that user
- You should be redirected to `/admin`

---

## Step 11: Run Linting (Optional)

```bash
npm run lint
```

Fix any linting errors before committing code.

---

## Common Setup Issues

### Issue: "SUPABASE_SERVICE_ROLE_KEY is not set"
**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`. This is different from the anon key.

### Issue: "SlipOK API not configured"
**Solution**: Ensure `SLIPOK_API_URL` and `SLIPOK_API_KEY` are set in `.env.local`, or set `SLIPOK_TEST_MODE=true` to bypass.

### Issue: Images not loading from Supabase Storage
**Solution**: Ensure `NEXT_PUBLIC_SUPABASE_URL` is set correctly. The Next.js config automatically whitelists the hostname.

### Issue: MCP not showing in IDE
**Solution**:
- Ensure you installed Supabase agent skills: `npx skills add supabase/agent-skills`
- Check that the MCP config file is in the correct location
- Restart your IDE

### Issue: TypeScript errors
**Solution**:
- Run `npx tsc --noEmit --skipLibCheck` to see specific errors
- Ensure all dependencies are installed: `npm install`
- Check that you're using Node.js v18 or higher

---

## Development Workflow

### Creating a New Feature

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run TypeScript check:
   ```bash
   npx tsc --noEmit --skipLibCheck
   ```

4. Run linting:
   ```bash
   npm run lint
   ```

5. Test your changes manually

6. Commit and push:
   ```bash
   git add .
   git commit -m "Description of your changes"
   git push origin feature/your-feature-name
   ```

### Testing Changes

Refer to `TESTING_GUIDE.md` for comprehensive testing procedures.

### Database Changes

If you need to modify the database schema:

1. Create a new SQL migration file in `supabase/`
2. Test the migration in Supabase SQL Editor
3. Update `supabase/schema.sql` if the change is permanent
4. Document the change in `AGENTS.md` if it affects business logic

---

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SLIPOK_API_URL`
   - `SLIPOK_API_KEY`
   - `SLIPOK_TEST_MODE` (set to `false` for production)
3. Deploy automatically on push to `main`

### GitHub Pages

- Only for static landing page in `docs/` folder
- Not suitable for full application
- See `README.md` for GitHub Pages setup

---

## Useful Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint

# TypeScript check
npx tsc --noEmit --skipLibCheck

# Install Supabase agent skills
npx skills add supabase/agent-skills
```

---

## Additional Resources

- **AGENTS.md** - Comprehensive project documentation for AI agents
- **README.md** - Basic project overview and quick start
- **TESTING_GUIDE.md** - Testing procedures and validation
- **IMPLEMENTATION_PLAN.md** - Original implementation plan
- **CMS New Athlete School.md** - Business requirements

---

## Support

If you encounter issues not covered in this guide:

1. Check the existing documentation files
2. Review the Supabase documentation: https://supabase.com/docs
3. Review the Next.js documentation: https://nextjs.org/docs
4. Check the project's GitHub issues (if available)

---

## Security Reminders

- **NEVER** commit `.env.local` to the repository
- **NEVER** share `SUPABASE_SERVICE_ROLE_KEY` publicly
- **NEVER** hardcode API keys in source code
- **ALWAYS** use environment variables for sensitive data
- **REGULARLY** rotate API keys for production

---

## Next Steps

After completing setup:

1. Read `AGENTS.md` to understand the project architecture
2. Review `TESTING_GUIDE.md` to understand testing procedures
3. Explore the codebase starting with `src/app/` and `src/lib/`
4. Make your first contribution!

---

## Troubleshooting Checklist

If something isn't working:

- [ ] Node.js v18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` created with all required variables
- [ ] Database schema applied (if fresh project)
- [ ] Phone trigger applied
- [ ] Storage buckets created
- [ ] TypeScript check passes
- [ ] Development server starts without errors
- [ ] Can access `http://localhost:3000`
- [ ] Can register and login
- [ ] MCP configured (if using Windsurf/Codex)

---

## IDE-Specific Notes

### VS Code
- Install recommended extensions from `.vscode/extensions.json` (if available)
- Use the built-in terminal for running commands

### Windsurf
- Follow MCP setup instructions above
- Use the built-in Supabase integration for database queries

### Codex Desktop
- Follow MCP setup instructions above
- Refer to Codex Desktop documentation for MCP config location

---

## Version History

- **April 2026**: Initial setup guide created
- **April 2026**: Added Supabase MCP setup instructions
- **April 2026**: Added phone trigger setup step
