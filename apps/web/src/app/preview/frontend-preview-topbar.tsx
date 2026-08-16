import { useState } from "react";
import { Bell, CalendarDays, ChevronDown, Search } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { SidebarTrigger } from "@/shared/components/ui/sidebar";

export function FrontendPreviewTopbar() {
  const [unit, setUnit] = useState("todas");
  const [period, setPeriod] = useState("2026-08");
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 px-3 py-2 backdrop-blur md:px-5">
      <div className="flex min-h-11 flex-wrap items-center gap-2">
        <SidebarTrigger className="shrink-0" />
        <div className="hidden min-w-0 flex-1 md:block">
          <p className="text-xs font-medium text-muted-foreground">Sistema Central</p>
          <p className="truncate text-sm font-semibold">Lander Solutions Ltda.</p>
        </div>

        {searchOpen ? (
          <div className="order-3 flex w-full items-center gap-2 md:order-none md:w-72">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus placeholder="Buscar no sistema" className="pl-9" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSearchOpen(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Buscar"
            aria-label="Buscar no sistema"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}

        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as unidades</SelectItem>
            <SelectItem value="music-os-360">Music OS 360</SelectItem>
            <SelectItem value="vivendo-da-musica">Vivendo da Música</SelectItem>
            <SelectItem value="corporativo">Corporativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[155px]">
            <CalendarDays className="h-4 w-4" />
            <SelectValue placeholder="Competência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026-08">Agosto / 2026</SelectItem>
            <SelectItem value="2026-07">Julho / 2026</SelectItem>
            <SelectItem value="2026-06">Junho / 2026</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="ghost" size="icon" title="Notificações" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" className="gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            LS
          </span>
          <span className="hidden text-xs sm:inline">Administrador</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
