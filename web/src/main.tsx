import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./hooks/useAuth";
import { wagmiConfig } from "./lib/wagmi";
import { ComingSoon, NotFound } from "./pages/ComingSoon";
import { HomePage } from "./pages/HomePage";
import { ProductPage } from "./pages/ProductPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/product/:id", element: <ProductPage /> },
      { path: "/shop/:address", element: <ComingSoon title="หน้าร้านของผู้ขาย" phase={6} /> },
      { path: "/cart", element: <ComingSoon title="ตะกร้าสินค้า" phase={6} /> },
      { path: "/checkout", element: <ComingSoon title="ชำระเงิน" phase={6} /> },
      { path: "/orders", element: <ComingSoon title="คำสั่งซื้อของฉัน" phase={6} /> },
      { path: "/seller/*", element: <ComingSoon title="ศูนย์ผู้ขาย" phase={6} /> },
      { path: "/account", element: <ComingSoon title="บัญชีของฉัน" phase={7} /> },
      { path: "/admin", element: <ComingSoon title="Admin Panel" phase={7} /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
