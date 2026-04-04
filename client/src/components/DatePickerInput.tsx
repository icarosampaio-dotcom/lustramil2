import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerInputProps {
  value: string; // formato "YYYY-MM-DD" (compatível com input[type=date])
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePickerInput({ value, onChange, placeholder = "Selecionar data", className }: DatePickerInputProps) {
  const [open, setOpen] = useState(false);

  // Converter string YYYY-MM-DD para Date
  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const isValidDate = selectedDate && isValid(selectedDate);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !isValidDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {isValidDate
            ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
            : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 z-[9999]"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={true}
        onInteractOutside={(e) => {
          // Previne fechar ao interagir com o calendário
          e.preventDefault();
          setOpen(false);
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        <Calendar
          mode="single"
          selected={isValidDate ? selectedDate : undefined}
          onSelect={handleSelect}
          autoFocus
          locale={ptBR}
        />
        {value && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
