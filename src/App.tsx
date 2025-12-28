import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { DefaultPageRedirect } from "@/components/layout/DefaultPageRedirect";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Journey from "./pages/Journey";
import Tasks from "./pages/Tasks";
import Documents from "./pages/Documents";
import Attendance from "./pages/Attendance";
import Trades from "./pages/Trades";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import Coach from "./pages/Coach";
import Settings from "./pages/Settings";
import ECommerce from "./pages/ECommerce";
import Finance from "./pages/Finance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<DefaultPageRedirect />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/journey" element={<Journey />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/coach" element={<Coach />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/ecommerce" element={<ECommerce />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
