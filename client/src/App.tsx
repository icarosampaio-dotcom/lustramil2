import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import Estoque from "./pages/Estoque";
import Notas from "./pages/Notas";
import Relatorios from "./pages/Relatorios";
import Entidades from "./pages/Entidades";
import AdminUsuarios from "./pages/AdminUsuarios";
import AlterarSenha from "./pages/AlterarSenha";
import ContasPagar from "./pages/ContasPagar";
import ContasReceber from "./pages/ContasReceber";
import Caixa from "./pages/Caixa";
import Insumos from "./pages/Insumos";
import FichaTecnica from "./pages/FichaTecnica";
import VendasAbc from "./pages/VendasAbc";
import CurvaAbc from "./pages/CurvaAbc";
import Ranking from "./pages/Ranking";
import DashboardExecutivo from "./pages/DashboardExecutivo";
import CometaConfiguracao from "./pages/CometaIntegration-Configuracao";
import CometaDashboard from "./pages/CometaIntegration-Dashboard";
import CometaPedidos from "./pages/CometaIntegration-Pedidos";
import CometaVendas from "./pages/CometaIntegration-Vendas";
import CometaEstoque from "./pages/CometaIntegration-Estoque";
import CometaDevolucoes from "./pages/CometaIntegration-Devolucoes";
import CometaMonitoramento from "./pages/CometaIntegration-Monitoramento";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/upload"} component={Upload} />
      <Route path={"/estoque"} component={Estoque} />
      <Route path={"/notas"} component={Notas} />
      <Route path={"/relatorios"} component={Relatorios} />
      <Route path={"/entidades"} component={Entidades} />
      <Route path={"/contas-pagar"} component={ContasPagar} />
      <Route path={"/contas-receber"} component={ContasReceber} />
      <Route path={"/caixa"} component={Caixa} />
      <Route path={"/insumos"} component={Insumos} />
      <Route path={"/ficha-tecnica"} component={FichaTecnica} />
      <Route path={"/vendas-abc"} component={VendasAbc} />
      <Route path={"/curva-abc"} component={CurvaAbc} />
      <Route path={"/ranking"} component={Ranking} />
      <Route path={"/dashboard-executivo"} component={DashboardExecutivo} />
      <Route path={"/cometa-integracao"} component={CometaConfiguracao} />
      <Route path={"/cometa-dashboard"} component={CometaDashboard} />
      <Route path={"/cometa-pedidos"} component={CometaPedidos} />
      <Route path={"/cometa-vendas"} component={CometaVendas} />
      <Route path={"/cometa-estoque"} component={CometaEstoque} />
      <Route path={"/cometa-devolucoes"} component={CometaDevolucoes} />
      <Route path={"/cometa-monitoramento"} component={CometaMonitoramento} />
      <Route path={"/admin/usuarios"} component={AdminUsuarios} />
      <Route path={"/alterar-senha"} component={AlterarSenha} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
