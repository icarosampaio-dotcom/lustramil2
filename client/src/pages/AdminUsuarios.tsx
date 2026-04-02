import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Shield,
  Users,
  MoreVertical,
  UserCog,
  Trash2,
  Loader2,
  Clock,
  ScrollText,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  Database,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AdminUsuariosPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user && user.role !== "admin") {
    setLocation("/");
    return null;
  }

  return (
    <DashboardLayout>
      <AdminContent />
    </DashboardLayout>
  );
}

function AdminContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Gestão de Usuários
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os usuários e permissões do sistema
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ScrollText className="h-4 w-4" />
            Log de Auditoria
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Database className="h-4 w-4" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTable />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogTable />
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <SystemPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTable() {
  const { data: usersList, isLoading } = trpc.admin.listUsers.useQuery();
  const { user: currentUser } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "role" | "delete" | "resetPassword";
    userId: number;
    userName: string;
    newRole?: "user" | "admin";
  } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const utils = trpc.useUtils();

  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("Permissão atualizada com sucesso!");
      utils.admin.listUsers.invalidate();
      setConfirmDialog(null);
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar permissão"),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário removido com sucesso!");
      utils.admin.listUsers.invalidate();
      setConfirmDialog(null);
    },
    onError: (err) => toast.error(err.message || "Erro ao remover usuário"),
  });

  const resetPasswordMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha resetada com sucesso!");
      setConfirmDialog(null);
      setResetPasswordValue("");
    },
    onError: (err) => toast.error(err.message || "Erro ao resetar senha"),
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Carregando usuários...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Usuários do Sistema ({usersList?.length || 0})</span>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="gap-2"
              size="sm"
            >
              <UserPlus className="h-4 w-4" />
              Criar Usuário
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersList && usersList.length > 0 ? (
                usersList.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name || "—"}
                        {isSelf && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Você
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">
                        {(u as any).username || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "admin" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {u.role === "admin" ? "Administrador" : "Usuário"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.lastSignedIn)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        {!isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmDialog({
                                    type: "role",
                                    userId: u.id,
                                    userName: u.name || "Usuário",
                                    newRole: u.role === "admin" ? "user" : "admin",
                                  })
                                }
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                {u.role === "admin"
                                  ? "Rebaixar para Usuário"
                                  : "Promover a Admin"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setResetPasswordValue("");
                                  setShowResetPassword(false);
                                  setConfirmDialog({
                                    type: "resetPassword",
                                    userId: u.id,
                                    userName: u.name || "Usuário",
                                  });
                                }}
                              >
                                <KeyRound className="mr-2 h-4 w-4" />
                                Resetar Senha
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setConfirmDialog({
                                    type: "delete",
                                    userId: u.id,
                                    userName: u.name || "Usuário",
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover Usuário
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {/* Confirm Dialog */}
      {confirmDialog && confirmDialog.type !== "resetPassword" && (
        <Dialog open onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {confirmDialog.type === "role"
                  ? "Alterar Permissão"
                  : "Remover Usuário"}
              </DialogTitle>
              <DialogDescription>
                {confirmDialog.type === "role"
                  ? `Deseja ${confirmDialog.newRole === "admin" ? "promover" : "rebaixar"} "${confirmDialog.userName}" para ${confirmDialog.newRole === "admin" ? "Administrador" : "Usuário"}?`
                  : `Tem certeza que deseja remover "${confirmDialog.userName}" do sistema? Esta ação não pode ser desfeita.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                Cancelar
              </Button>
              <Button
                variant={confirmDialog.type === "delete" ? "destructive" : "default"}
                disabled={updateRoleMutation.isPending || deleteUserMutation.isPending}
                onClick={() => {
                  if (confirmDialog.type === "role" && confirmDialog.newRole) {
                    updateRoleMutation.mutate({
                      userId: confirmDialog.userId,
                      role: confirmDialog.newRole,
                    });
                  } else if (confirmDialog.type === "delete") {
                    deleteUserMutation.mutate({ userId: confirmDialog.userId });
                  }
                }}
                className="gap-2"
              >
                {(updateRoleMutation.isPending || deleteUserMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset Password Dialog */}
      {confirmDialog && confirmDialog.type === "resetPassword" && (
        <Dialog open onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Resetar Senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para "{confirmDialog.userName}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="resetPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="resetPassword"
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Mín. 6 caracteres"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                Cancelar
              </Button>
              <Button
                disabled={resetPasswordMutation.isPending || resetPasswordValue.length < 6}
                onClick={() => {
                  resetPasswordMutation.mutate({
                    userId: confirmDialog.userId,
                    newPassword: resetPasswordValue,
                  });
                }}
                className="gap-2"
              >
                {resetPasswordMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Resetar Senha
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── Create User Dialog ──────────────────────────────────
function CreateUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.admin.listUsers.invalidate();
      resetForm();
      onClose();
    },
    onError: (err) => toast.error(err.message || "Erro ao criar usuário"),
  });

  const resetForm = () => {
    setUsername("");
    setName("");
    setPassword("");
    setRole("user");
    setShowPassword(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim() || !password) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      toast.error("O nome de usuário deve conter apenas letras, números, pontos, hífens ou underscores.");
      return;
    }
    createUserMutation.mutate({
      username: username.trim(),
      name: name.trim(),
      password,
      role,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo usuário no sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="newName">Nome Completo</Label>
            <Input
              id="newName"
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newUsername">Nome de Usuário (login)</Label>
            <Input
              id="newUsername"
              placeholder="Ex: joao.silva"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Apenas letras, números, pontos, hífens e underscores.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Senha Inicial</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Permissão</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending} className="gap-2">
              {createUserMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Criar Usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Audit Log Table ─────────────────────────────────────
function AuditLogTable() {
  const { data: logs, isLoading } = trpc.admin.auditLogs.useQuery({ limit: 100 });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      LOGIN: "bg-blue-100 text-blue-800",
      UPLOAD: "bg-blue-100 text-blue-800",
      PROCESS_INVOICE: "bg-green-100 text-green-800",
      PROCESS_INVOICE_ERROR: "bg-red-100 text-red-800",
      UPDATE: "bg-amber-100 text-amber-800",
      UPDATE_ROLE: "bg-purple-100 text-purple-800",
      CREATE_USER: "bg-emerald-100 text-emerald-800",
      CHANGE_PASSWORD: "bg-indigo-100 text-indigo-800",
      RESET_PASSWORD: "bg-orange-100 text-orange-800",
      DELETE_USER: "bg-red-100 text-red-800",
    };
    return colors[action] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Carregando logs...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico de Ações
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Recurso</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs && logs.length > 0 ? (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {log.userName || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}
                    >
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.resource}
                    {log.resourceId ? ` #${log.resourceId}` : ""}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {log.details || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {log.ipAddress || "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum registro de auditoria encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


function SystemPanel() {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const utils = trpc.useUtils();

  const clearAllMutation = trpc.admin.clearAllData.useMutation({
    onSuccess: () => {
      toast.success("Todos os dados foram limpos com sucesso!");
      utils.invalidate();
      setShowClearDialog(false);
      setConfirmText("");
    },
    onError: (err) => toast.error(err.message || "Erro ao limpar dados"),
  });

  return (
    <>
      <div className="space-y-6">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <h3 className="font-semibold text-sm mb-1">Limpar Todos os Dados</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Esta ação irá remover permanentemente todos os produtos, notas fiscais,
                movimentações, fornecedores, clientes e logs de auditoria do sistema.
                Os usuários cadastrados serão mantidos. Esta ação não pode ser desfeita.
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmText("");
                  setShowClearDialog(true);
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Limpar Todos os Dados
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmação dupla */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Limpeza Total
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os dados serão permanentemente removidos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm font-medium text-destructive mb-2">Serão removidos:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Todos os produtos cadastrados</li>
                <li>Todas as notas fiscais processadas</li>
                <li>Todas as movimentações de estoque</li>
                <li>Todos os fornecedores e clientes</li>
                <li>Todos os logs de auditoria</li>
              </ul>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Digite <span className="font-bold text-destructive">LIMPAR TUDO</span> para confirmar:
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="LIMPAR TUDO"
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "LIMPAR TUDO" || clearAllMutation.isPending}
              onClick={() => clearAllMutation.mutate()}
              className="gap-2"
            >
              {clearAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Confirmar Limpeza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
