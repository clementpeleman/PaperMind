"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Maximize2 } from "lucide-react";

interface CustomHeightDialogProps {
  currentHeight: number;
  onHeightChange: (height: number) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CustomHeightDialog({ currentHeight, onHeightChange, open: controlledOpen, onOpenChange }: CustomHeightDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [height, setHeight] = React.useState(currentHeight.toString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numHeight = parseInt(height);
    if (!isNaN(numHeight) && numHeight >= 32 && numHeight <= 200) {
      onHeightChange(numHeight);
      setOpen(false);
    }
  };

  React.useEffect(() => {
    setHeight(currentHeight.toString());
  }, [currentHeight]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="p-1">
            <Maximize2 className="h-3 w-3" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            Custom Row Height
          </DialogTitle>
          <DialogDescription>
            Adjust the row height to improve readability of your content. Perfect for viewing longer AI-generated responses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="height" className="text-sm font-medium">Height (pixels)</Label>
              <div className="relative">
                <Input
                  id="height"
                  type="number"
                  min="32"
                  max="200"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Enter height"
                  className="pr-8"
                  required
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">px</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Presets</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHeight("48")}
                  className="text-xs"
                >
                  Compact (48px)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHeight("80")}
                  className="text-xs"
                >
                  Spacious (80px)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHeight("120")}
                  className="text-xs"
                >
                  Extra Tall (120px)
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
              <div className="font-medium mb-1">💡 Tips:</div>
              <ul className="space-y-1 text-xs">
                <li>• 48-60px: Good for scanning many papers</li>
                <li>• 80-100px: Ideal for reading AI responses</li>
                <li>• 120px+: Best for long content and analysis</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary">
              Apply Height
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}