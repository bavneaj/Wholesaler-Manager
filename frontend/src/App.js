import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { I18nProvider } from "@/context/I18nContext";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Layout from "@/components/app/Layout";
import HomePage from "@/pages/Home";
import Wholesalers from "@/pages/Wholesalers";
import Orders from "@/pages/Orders";
import Payments from "@/pages/Payments";
import More from "@/pages/More";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return <div className="grid min-h-screen place-items-center text-sm text-stone-500">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-stone-500">Loading…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster richColors position="top-center" />
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
              <Route element={<Protected><Layout /></Protected>}>
                <Route path="/" element={<HomePage />} />
                <Route path="/wholesalers" element={<Wholesalers />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/more" element={<More />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </div>
  );
}

export default App;
