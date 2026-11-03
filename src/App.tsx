import { StoreProvider } from '@/context/StoreContext';
import { matchPath, usePathname } from '@/lib/router';
import HomePage from '@/pages/HomePage';
import CatalogPage from '@/pages/CatalogPage';
import EditorPage from '@/pages/EditorPage';
import CartPage from '@/pages/CartPage';
import CheckoutPage from '@/pages/CheckoutPage';
import OrderPage from '@/pages/OrderPage';
import AdminOrdersPage from '@/pages/admin/AdminOrdersPage';
import AdminCatalogPage from '@/pages/admin/AdminCatalogPage';
import AdminCustomersPage from '@/pages/admin/AdminCustomersPage';
import AdminOrderDetailPage from '@/pages/admin/AdminOrderDetailPage';
import AdminResetPasswordPage from '@/pages/admin/AdminResetPasswordPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AccountAuthPage from '@/pages/account/AccountAuthPage';
import NewPasswordPage from '@/pages/account/NewPasswordPage';
import AccountPage from '@/pages/account/AccountPage';
import MyOrdersPage from '@/pages/account/MyOrdersPage';
import MyOrderDetailPage from '@/pages/account/MyOrderDetailPage';

function renderRoute(path: string) {
  if (path === '/revelar') return <EditorPage />;
  if (path === '/produtos') return <CatalogPage />;
  if (path === '/carrinho') return <CartPage />;
  if (path === '/finalizar') return <CheckoutPage />;
  if (path === '/entrar') return <AccountAuthPage />;
  if (path === '/conta/nova-senha') return <NewPasswordPage />;
  if (path === '/conta') return <AccountPage />;
  if (path === '/meus-pedidos') return <MyOrdersPage />;
  const myOrderParams = matchPath('/meus-pedidos/:id', path);
  if (myOrderParams) return <MyOrderDetailPage orderId={myOrderParams.id} />;
  if (path === '/admin') return <AdminOrdersPage />;
  if (path === '/admin/catalogo') return <AdminCatalogPage />;
  if (path === '/admin/clientes') return <AdminCustomersPage />;
  if (path === '/admin/redefinir-senha') return <AdminResetPasswordPage />;
  if (path === '/admin/configuracoes') return <AdminSettingsPage />;
  const orderParams = matchPath('/pedido/:token', path);
  if (orderParams) return <OrderPage token={orderParams.token} />;
  const adminOrderParams = matchPath('/admin/pedidos/:id', path);
  if (adminOrderParams) return <AdminOrderDetailPage orderId={adminOrderParams.id} />;
  return <HomePage />;
}

export default function App() {
  const path = usePathname();
  return <StoreProvider>{renderRoute(path)}</StoreProvider>;
}
