"use client";

import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Upload,
  Package,
  FileText,
  CreditCard,
  HandCoins,
  Wallet,
  BarChart3,
  Users,
  Shield,
} from "lucide-react";

const PAGES: { path: string; label: string; icon: typeof LayoutDashboard }[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/upload", label: "Nova Movimentação", icon: Upload },
  { path: "/estoque", label: "Estoque", icon: Package },
  { path: "/notas", label: "Notas Fiscais", icon: FileText },
  { path: "/contas-pagar", label: "Contas a Pagar", icon: CreditCard },
  { path: "/contas-receber", label: "Contas a Receber", icon: HandCoins },
  { path: "/caixa", label: "Caixa", icon: Wallet },
  { path: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { path: "/entidades", label: "Fornecedores / Clientes", icon: Users },
  { path: "/admin/usuarios", label: "Gestão de Usuários", icon: Shield },
];

export default function QuickSearchCommand() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: products = [] } = trpc.products.list.useQuery(undefined, { enabled: open });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const run = (path: string) => {
    setLocation(path);
    setOpen(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Busca rápida"
      description="Navegue ou busque um produto. Pressione Ctrl+K ou Cmd+K para abrir."
    >
      <CommandInput placeholder="Digite uma página ou nome de produto..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {PAGES.map(({ path, label, icon: Icon }) => (
            <CommandItem
              key={path}
              value={`${label} ${path}`}
              onSelect={() => run(path)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {products.length > 0 && (
          <CommandGroup heading="Produtos (ir para Estoque)">
            {products.slice(0, 8).map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.name} ${p.category || ""} ${p.reference || ""}`}
                onSelect={() => {
                  run(`/estoque?q=${encodeURIComponent(p.name)}`);
                }}
              >
                <Package className="h-4 w-4" />
                <span className="truncate">{p.name}</span>
                {p.category && (
                  <span className="text-muted-foreground text-xs ml-1">({p.category})</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
