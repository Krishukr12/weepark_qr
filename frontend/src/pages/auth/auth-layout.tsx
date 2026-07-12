import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MapPin, QrCode, Zap } from 'lucide-react';
import { BrandMark } from '@/components/layout/sidebar';

const highlights = [
  { icon: QrCode, title: 'QR-first parking', text: 'Employees scan a site QR and park in seconds — no app installs.' },
  { icon: Zap, title: 'Real-time pickups', text: 'Valets get instant pickup requests the moment "GET MY CAR" is tapped.' },
  { icon: MapPin, title: 'Multi-site control', text: 'Capacity, occupancy and valet coverage across every location.' },
];

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-zinc-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(600px circle at 20% 20%, oklch(0.72 0.17 160 / 0.25), transparent 45%), radial-gradient(700px circle at 80% 80%, oklch(0.55 0.15 250 / 0.2), transparent 50%)',
          }}
        />
        <BrandMark onDark className="relative" />
        <div className="relative space-y-8">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md text-3xl font-semibold leading-tight tracking-tight"
          >
            Parking management that feels effortless.
          </motion.h2>
          <div className="space-y-5">
            {highlights.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + index * 0.1 }}
                className="flex items-start gap-3.5"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/8 backdrop-blur">
                  <item.icon className="size-4.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{item.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} WeePark · Smart Parking Management</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
