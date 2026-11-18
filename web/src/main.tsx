import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./hooks/useAuth";
import { wagmiConfig } from "./lib/wagmi";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ComingSoon, NotFound } from "./pages/ComingSoon";
import { HomePage } from "./pages/HomePage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductPage } from "./pages/ProductPage";
import { SellerCenter } from "./pages/SellerCenter";
import { ShopPage } from "./pages/ShopPage";
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
      { path: "/shop/:address", element: <ShopPage /> },
      { path: "/cart", element: <CartPage /> },
      { path: "/checkout", element: <CheckoutPage /> },
      { path: "/orders", element: <OrdersPage /> },
      { path: "/seller", element: <SellerCenter /> },
      { path: "/seller/products/new", element: <ProductFormPage /> },
      { path: "/seller/products/:id/edit", element: <ProductFormPage /> },
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
