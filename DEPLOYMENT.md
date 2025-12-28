# Deployment & Self-Hosting Guide

This guide covers how to set up your own Supabase project and host the application using a Node.js server.

## 1. Supabase Setup

You need a Supabase project to host your database and authentication.

1.  **Create a Project**: Go to [Supabase](https://supabase.com/) and create a new project.
2.  **Get Credentials**:
    *   Go to **Project Settings** -> **API**.
    *   Copy the `Project URL` and `anon` `public` key.
3.  **Environment Variables**:
    *   Create a `.env` file in the root of your project (copy `.env.example` if it exists).
    *   Update the following variables:
        ```env
        VITE_SUPABASE_URL=your_project_url
        VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
        ```

### Database Migration

To run the application, you need to apply the database schema.

1.  **Install Supabase CLI**: [Follow instructions here](https://supabase.com/docs/guides/cli).
2.  **Login**: `supabase login`
3.  **Link Project**: `supabase link --project-ref your-project-id` (find project ID in general settings).
4.  **Push Migrations**:
    ```sh
    supabase db push
    ```
    This will apply all migrations from the `supabase/migrations` folder to your remote database.

## 2. Building the Application

The frontend is a React Single Page Application (SPA). You need to build it into static files.

```sh
npm run build
```

This creates a `dist/` folder containing your compiled application.

## 3. Node.js Server Setup

We use a simple Express server to serve the static files and handle SPA routing.

1.  **Install Production Dependencies**:
    ```sh
    npm install express
    ```
    *(This is already included in the project dependencies)*

2.  **Start the Server**:
    ```sh
    npm start
    ```

The server runs on port 8080 by default. You can access it at `http://localhost:8080`.

## 4. Production Hosting

To host this on a VPS (like DigitalOcean, AWS EC2, etc.):

1.  **Copy Files**: Copy the entire project folder to your server.
2.  **Install Dependencies**: Run `npm install --production` (or just `npm install`).
3.  **Build**: Run `npm run build` (ensure `.env` variables are set before building!).
4.  **Run with Process Manager**: Use a tool like `pm2` to keep the server running.
    ```sh
    npm install -g pm2
    pm2 start server.js --name "pmp-app"
    ```

### Nginx Reverse Proxy (Optional but Recommended)

It's best practice to put Nginx in front of your Node.js server to handle SSL and standard HTTP traffic on port 80/443.

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
## 5. Deploying on Hostinger (Shared/Cloud Hosting)

If you are using Hostinger's "Node.js App" feature (available on Cloud & some Shared plans):

1.  **Prepare Your Application**:
    *   Ensure your local project builds successfully (`npm run build`).
    *   Delete the `node_modules` folder locally to reduce upload size.
    *   Compress your project folder into a `.zip` file.

2.  **Create Node.js Application in Hostinger**:
    *   Log in to **hPanel** -> **Websites** -> **Manage**.
    *   Search for **Node.js** in the side menu.
    *   Click **Create Application**.
    *   **Node.js Version**: Select 18 (or latest recommended).
    *   **Application Mode**: Production.
    *   **Application Root**: `public_html/pmp-app` (or your desired path).
    *   **Application Startup File**: `server.js`.
    *   Click **Create**.

3.  **Upload Files**:
    *   Go to **File Manager**.
    *   Navigate to your Application Root (e.g., `public_html/pmp-app`).
    *   Upload and unzip your project files.

4.  **Install Dependencies**:
    *   Go back to the **Node.js** page in hPanel.
    *   Click **NPM Install** (this installs dependencies on the server).

5.  **Build on Server (Recommended)**:
    *   It is often safer to build on the server if possible. You can run commands via the "Run NPM Script" section or use SSH.
    *   If you built locally and uploaded the `dist` folder, you can skip this.
    *   If you uploaded source code, you need to run `npm run build`. You can do this by adding a "build" script execution or via SSH:
        ```sh
        cd public_html/pmp-app
        npm run build
        ```

6.  **Restart Application**:
    *   Click **Restart** on the Node.js page.
    *   Your app should now be live!

### Troubleshooting
- **403/404 Errors**: Ensure your `server.js` points correctly to the `dist` folder.

## 6. Pushing to GitHub

To save your code and enable easier deployments (e.g., auto-deployments on Hostinger), push your code to GitHub.

1.  **Initialize Git (if not already done)**:
    ```sh
    git init
    git add .
    git commit -m "Initial commit"
    ```

2.  **Create a Repository on GitHub**:
    *   Go to [GitHub.com](https://github.com) and create a new repository.
    *   Do **not** initialize with README/gitignore (you already have them).

3.  **Link and Push**:
    *   Copy the URL of your new repository (e.g., `https://github.com/username/pmp-journey.git`).
    *   Run the following commands in your terminal:
        ```sh
        git branch -M main
        git remote add origin YOUR_REPO_URL
        git push -u origin main
        ```

4.  **Connect to Hostinger (Optional)**:
    *   In Hostinger Node.js settings, you might see an option to deploy from Git.
    *   You can link your GitHub repository to automatically pull changes when you push to main.

