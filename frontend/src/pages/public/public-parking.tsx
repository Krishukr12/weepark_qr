import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  CircleParking,
  Clock,
  KeyRound,
  MapPin,
  Sparkles,
  User,
  Warehouse,
} from 'lucide-react';
import { publicApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { FUEL_TYPES, publicGuestSchema, publicRegisterSchema, VEHICLE_TYPES, type PublicRegisterForm } from '@/lib/form-schemas';
import { cn, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/form-field';
import { BrandLogo } from '@/components/layout/sidebar';
import type { FuelType, PublicParkingStatus, PublicSite, PublicVehicleDisplay, VehicleType } from '@/types';

type Step = 'lookup' | 'register' | 'confirm' | 'parked';

const SESSION_STORAGE_KEY = 'weepark.parkingSession';

interface StoredSession {
  siteCode: string;
  sessionToken: string;
  ticketCode: string;
  vehicleNumber: string;
}

function useLiveDuration(startIso: string | undefined): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (!startIso) return '—';
    const minutes = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 60_000));
    return formatDuration(minutes);
  }, [startIso, now]);
}

function SiteHeader({ site }: { site: PublicSite }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <BrandLogo className="size-10" />
        <div>
          <p className="text-lg font-semibold leading-tight tracking-tight">{site.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {site.address}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono">{site.siteCode}</Badge>
        <Badge variant={site.occupancy.available > 0 ? 'success' : 'destructive'}>
          <Warehouse /> {site.occupancy.available} spaces available
        </Badge>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function PublicParkingPage() {
  const { siteCode = '' } = useParams();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('lookup');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [display, setDisplay] = useState<PublicVehicleDisplay | null>(null);
  const [parkToken, setParkToken] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [parking, setParking] = useState<PublicParkingStatus | null>(null);
  const [pollErrors, setPollErrors] = useState(0);
  const [pageVisible, setPageVisible] = useState(typeof document === 'undefined' ? true : document.visibilityState === 'visible');

  const site = useQuery({
    queryKey: ['public-site', siteCode],
    queryFn: () => publicApi.getSite(siteCode),
    retry: false,
  });

  const organizations = useQuery({
    queryKey: ['public-organizations', siteCode],
    queryFn: () => publicApi.organizations(siteCode),
    enabled: step === 'register',
  });

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Restore an in-progress parking session on refresh — only for this site.
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw || !siteCode) return;
    try {
      const stored = JSON.parse(raw) as StoredSession;
      if (stored.siteCode !== siteCode || !stored.sessionToken) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      publicApi
        .getSession(stored.sessionToken)
        .then((status) => {
          if (status.status === 'COMPLETED' || status.status === 'CANCELLED') {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            return;
          }
          setSessionToken(stored.sessionToken);
          setParking(status);
          setStep('parked');
        })
        .catch(() => localStorage.removeItem(SESSION_STORAGE_KEY));
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [siteCode]);

  const entryStatus = useQuery({
    queryKey: ['public-session', sessionToken],
    queryFn: () => publicApi.getSession(sessionToken ?? ''),
    enabled: step === 'parked' && Boolean(sessionToken) && pageVisible,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'CANCELLED') return false;
      if (!pageVisible) return false;
      const failures = query.state.errorUpdateCount + pollErrors;
      if (failures > 8) return false;
      return Math.min(10_000 * 2 ** Math.min(failures, 4), 60_000);
    },
    retry: 1,
  });

  const liveEntry = entryStatus.data ?? parking;
  const duration = useLiveDuration(liveEntry?.parkedAt);

  useEffect(() => {
    if (entryStatus.isError) setPollErrors((n) => n + 1);
    if (entryStatus.isSuccess) setPollErrors(0);
  }, [entryStatus.isError, entryStatus.isSuccess]);

  useEffect(() => {
    if (liveEntry?.status === 'COMPLETED') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [liveEntry?.status]);

  const lookup = useMutation({
    mutationFn: () => publicApi.lookupVehicle(siteCode, vehicleNumber),
    onSuccess: (result) => {
      if (result.alreadyParked && result.sessionToken && result.parking) {
        setSessionToken(result.sessionToken);
        setParking(result.parking);
        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            siteCode,
            sessionToken: result.sessionToken,
            ticketCode: result.parking.ticketCode,
            vehicleNumber: result.vehicleNumber,
          } satisfies StoredSession),
        );
        setStep('parked');
        return;
      }
      if (result.found && !result.canParkAtSite) {
        toast.error(
          `${result.display?.organizationName ?? 'Your organization'} is not assigned to park at this site. Please contact your admin.`,
        );
        return;
      }
      if (result.found && result.parkToken && result.display) {
        setDisplay(result.display);
        setParkToken(result.parkToken);
        setStep('confirm');
        return;
      }
      setStep('register');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const registerForm = useForm<PublicRegisterForm>({
    resolver: zodResolver(publicRegisterSchema),
    defaultValues: {
      vehicleType: 'CAR', fuelType: 'PETROL', brand: '', model: '', color: '',
      employeeName: '', employeeEmail: '', employeePhone: '', employeeCode: '', organizationId: '',
    },
  });

  const register = useMutation({
    mutationFn: (values: PublicRegisterForm) =>
      publicApi.quickRegister(siteCode, {
        vehicleNumber,
        vehicleType: values.vehicleType,
        fuelType: values.fuelType,
        brand: values.brand,
        model: values.model,
        color: values.color,
        employee: {
          name: values.employeeName,
          email: values.employeeEmail,
          phone: values.employeePhone,
          employeeCode: values.employeeCode,
          organizationId: values.organizationId,
        },
      }),
    onSuccess: (registered) => {
      setDisplay(registered.display);
      setParkToken(registered.parkToken);
      setStep('confirm');
      toast.success('Vehicle registered');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const park = useMutation({
    mutationFn: () => publicApi.park(siteCode, parkToken ?? ''),
    onSuccess: (created) => {
      setParking(created.parking);
      setSessionToken(created.sessionToken);
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          siteCode,
          sessionToken: created.sessionToken,
          ticketCode: created.parking.ticketCode,
          vehicleNumber: created.parking.vehicleNumber,
        } satisfies StoredSession),
      );
      setStep('parked');
      void queryClient.invalidateQueries({ queryKey: ['public-site', siteCode] });
      toast.success('Vehicle parked — enjoy your day!');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const guestCheckIn = useMutation({
    mutationFn: async () => {
      const result = await publicApi.guestCheckIn(siteCode, vehicleNumber, guestPhone);
      if (result.alreadyParked && result.sessionToken && result.parking) {
        return { kind: 'restored' as const, result };
      }
      if (!result.parkToken) {
        throw new Error('Unable to start parking for this vehicle');
      }
      const created = await publicApi.park(siteCode, result.parkToken);
      return { kind: 'parked' as const, created };
    },
    onSuccess: (payload) => {
      if (payload.kind === 'restored') {
        const { result } = payload;
        setSessionToken(result.sessionToken!);
        setParking(result.parking!);
        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            siteCode,
            sessionToken: result.sessionToken!,
            ticketCode: result.parking!.ticketCode,
            vehicleNumber: result.vehicleNumber,
          } satisfies StoredSession),
        );
        setStep('parked');
        return;
      }
      setParking(payload.created.parking);
      setSessionToken(payload.created.sessionToken);
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          siteCode,
          sessionToken: payload.created.sessionToken,
          ticketCode: payload.created.parking.ticketCode,
          vehicleNumber: payload.created.parking.vehicleNumber,
        } satisfies StoredSession),
      );
      setStep('parked');
      void queryClient.invalidateQueries({ queryKey: ['public-site', siteCode] });
      toast.success('Vehicle parked — enjoy your day!');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const requestPickup = useMutation({
    mutationFn: () =>
      publicApi.requestPickup(sessionToken ?? '', liveEntry?.vehicleNumber ?? '', liveEntry?.ticketCode ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-session'] });
      toast.success('Pickup requested — a valet is on the way!');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const resetFlow = () => {
    setStep('lookup');
    setDisplay(null);
    setParkToken(null);
    setSessionToken(null);
    setParking(null);
    setVehicleNumber('');
    setGuestPhone('');
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  if (site.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-5 pt-10">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (site.isError || !site.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-5">
        <Card className="max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-warning" />
          <h1 className="mt-4 text-lg font-semibold">Parking site not found</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This QR code points to a site that doesn't exist or is currently inactive. Please contact the parking staff.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-md flex-col gap-5 p-5 pb-16 pt-8">
        <SiteHeader site={site.data} />

        <AnimatePresence mode="wait">
          {/* STEP 1 — vehicle number lookup */}
          {step === 'lookup' && site.data.parkingMode === 'B2C' ? (
            <motion.div key="guest" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
              <Card className="space-y-5 p-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">Park your vehicle</h2>
                  <p className="text-sm text-muted-foreground">Enter your vehicle number and phone to park.</p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = publicGuestSchema.safeParse({ vehicleNumber, phone: guestPhone });
                    if (!parsed.success) {
                      toast.error(parsed.error.issues[0]?.message ?? 'Enter a valid vehicle number and phone');
                      return;
                    }
                    guestCheckIn.mutate();
                  }}
                  className="space-y-4"
                >
                  <Input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="KA 01 AB 1234"
                    className="h-14 text-center font-mono text-xl tracking-widest uppercase"
                    autoFocus
                  />
                  <Input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Phone number"
                    inputMode="tel"
                    className="h-12"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    variant="brand"
                    className="h-13 w-full text-base"
                    disabled={vehicleNumber.trim().length < 4 || guestPhone.trim().length < 10}
                    loading={guestCheckIn.isPending}
                  >
                    PARK MY VEHICLE <CircleParking />
                  </Button>
                </form>
              </Card>
            </motion.div>
          ) : null}

          {step === 'lookup' && site.data.parkingMode !== 'B2C' ? (
            <motion.div key="lookup" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
              <Card className="space-y-5 p-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">Park your vehicle</h2>
                  <p className="text-sm text-muted-foreground">Enter your vehicle number to get started.</p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (vehicleNumber.trim().length >= 4) lookup.mutate();
                  }}
                  className="space-y-4"
                >
                  <Input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="KA 01 AB 1234"
                    className="h-14 text-center font-mono text-xl tracking-widest uppercase"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="lg"
                    variant="brand"
                    className="h-13 w-full text-base"
                    disabled={vehicleNumber.trim().length < 4}
                    loading={lookup.isPending}
                  >
                    Continue <ArrowRight />
                  </Button>
                </form>
              </Card>
            </motion.div>
          ) : null}

          {/* STEP 2 — quick registration */}
          {step === 'register' ? (
            <motion.div key="register" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
              <Card className="space-y-5 p-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4.5 text-brand" />
                    <h2 className="text-lg font-semibold tracking-tight">Quick registration</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono font-medium text-foreground">{vehicleNumber}</span> isn't registered yet.
                    Takes under a minute.
                  </p>
                </div>
                <form onSubmit={registerForm.handleSubmit((values) => register.mutate(values))} className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your details</p>
                  <FormField label="Full name" error={registerForm.formState.errors.employeeName?.message} required>
                    <Input placeholder="Arjun Mehta" {...registerForm.register('employeeName')} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Employee ID" error={registerForm.formState.errors.employeeCode?.message} required>
                      <Input placeholder="EMP-1024" {...registerForm.register('employeeCode')} />
                    </FormField>
                    <FormField label="Phone" error={registerForm.formState.errors.employeePhone?.message} required>
                      <Input placeholder="98765 43210" inputMode="tel" {...registerForm.register('employeePhone')} />
                    </FormField>
                  </div>
                  <FormField label="Work email" error={registerForm.formState.errors.employeeEmail?.message} required>
                    <Input type="email" placeholder="arjun@company.com" {...registerForm.register('employeeEmail')} />
                  </FormField>
                  <FormField label="Organization" error={registerForm.formState.errors.organizationId?.message} required>
                    <Select
                      value={registerForm.watch('organizationId')}
                      onValueChange={(value) => registerForm.setValue('organizationId', value, { shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your company" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.data?.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehicle details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Type" required>
                      <Select
                        value={registerForm.watch('vehicleType')}
                        onValueChange={(value) => registerForm.setValue('vehicleType', value as VehicleType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VEHICLE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Fuel" required>
                      <Select
                        value={registerForm.watch('fuelType')}
                        onValueChange={(value) => registerForm.setValue('fuelType', value as FuelType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FUEL_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Brand" error={registerForm.formState.errors.brand?.message}>
                      <Input placeholder="Hyundai" {...registerForm.register('brand')} />
                    </FormField>
                    <FormField label="Model" error={registerForm.formState.errors.model?.message}>
                      <Input placeholder="Creta" {...registerForm.register('model')} />
                    </FormField>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" size="lg" onClick={resetFlow}>
                      <ArrowLeft /> Back
                    </Button>
                    <Button type="submit" size="lg" variant="brand" className="flex-1" loading={register.isPending}>
                      Register & continue
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          ) : null}

          {/* STEP 3 — confirm and park */}
          {step === 'confirm' && display ? (
            <motion.div key="confirm" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}>
              <Card className="space-y-5 p-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">Confirm details</h2>
                  <p className="text-sm text-muted-foreground">Everything look right?</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border p-4">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Car className="size-3.5" /> Vehicle
                    </p>
                    <p className="font-mono text-xl font-semibold tracking-wide">{display.vehicleNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {[display.brand, display.model, display.color].filter(Boolean).join(' · ') || display.vehicleType}
                    </p>
                  </div>
                  <div className="rounded-xl border px-4 py-2">
                    <p className="flex items-center gap-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <User className="size-3.5" /> Employee
                    </p>
                    <InfoRow label="Name" value={display.employeeName} />
                    <InfoRow label="Employee ID" value={display.employeeCode} />
                  </div>
                  <div className="rounded-xl border px-4 py-2">
                    <p className="flex items-center gap-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Building2 className="size-3.5" /> Organization & site
                    </p>
                    <InfoRow label="Organization" value={display.organizationName} />
                    <InfoRow label="Parking site" value={site.data.name} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="lg" onClick={resetFlow}>
                    <ArrowLeft /> Back
                  </Button>
                  <Button
                    size="lg"
                    variant="brand"
                    className="h-13 flex-1 text-base font-semibold"
                    onClick={() => park.mutate()}
                    disabled={!parkToken}
                    loading={park.isPending}
                  >
                    <CircleParking /> PARK MY VEHICLE
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}

          {/* STEP 4 — parked / pickup */}
          {step === 'parked' && liveEntry ? (
            <motion.div key="parked" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="space-y-4">
              <Card className="overflow-hidden p-0">
                <div
                  className={cn(
                    'flex items-center gap-3 px-6 py-4 text-white',
                    liveEntry.status === 'PARKED' && 'bg-emerald-600',
                    liveEntry.status === 'PICKUP_REQUESTED' && 'bg-amber-500',
                    liveEntry.status === 'PICKUP_IN_PROGRESS' && 'bg-blue-600',
                    liveEntry.status === 'COMPLETED' && 'bg-zinc-700',
                  )}
                >
                  {liveEntry.status === 'PARKED' ? <CheckCircle2 className="size-5" /> : null}
                  {liveEntry.status === 'PICKUP_REQUESTED' ? <Clock className="size-5 animate-pulse" /> : null}
                  {liveEntry.status === 'PICKUP_IN_PROGRESS' ? <KeyRound className="size-5" /> : null}
                  {liveEntry.status === 'COMPLETED' ? <CheckCircle2 className="size-5" /> : null}
                  <div>
                    <p className="font-semibold">
                      {liveEntry.status === 'PARKED' && 'Vehicle parked safely'}
                      {liveEntry.status === 'PICKUP_REQUESTED' && 'Finding a valet…'}
                      {liveEntry.status === 'PICKUP_IN_PROGRESS' && 'Valet is getting your car'}
                      {liveEntry.status === 'COMPLETED' && 'Vehicle delivered'}
                    </p>
                    <p className="text-xs text-white/80">
                      {liveEntry.status === 'PARKED' && 'Tap GET MY CAR when you\'re ready to leave.'}
                      {liveEntry.status === 'PICKUP_REQUESTED' && 'All valets at this site have been notified.'}
                      {liveEntry.status === 'PICKUP_IN_PROGRESS' &&
                        `${liveEntry.pickupAcceptedByName ?? 'A valet'} accepted your request.`}
                      {liveEntry.status === 'COMPLETED' && 'Thanks for parking with WeePark!'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-2xl font-semibold tracking-wide">{liveEntry.vehicleNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {[liveEntry.brand, liveEntry.model].filter(Boolean).join(' ') || liveEntry.vehicleType}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">{liveEntry.ticketCode}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/60 p-3.5">
                      <p className="text-xs text-muted-foreground">Parked at</p>
                      <p className="mt-0.5 font-semibold">{Number.isNaN(new Date(liveEntry.parkedAt).getTime()) ? '—' : format(new Date(liveEntry.parkedAt), 'HH:mm')}</p>
                      <p className="text-xs text-muted-foreground">{Number.isNaN(new Date(liveEntry.parkedAt).getTime()) ? '' : format(new Date(liveEntry.parkedAt), 'dd MMM yyyy')}</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3.5">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="mt-0.5 font-semibold tabular-nums">
                        {liveEntry.status === 'COMPLETED' ? formatDuration(liveEntry.durationMinutes) : duration}
                      </p>
                      <p className="text-xs text-muted-foreground">{liveEntry.siteName}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border px-4 py-1">
                    <InfoRow label="Employee" value={liveEntry.employeeName} />
                    <InfoRow label="Organization" value={liveEntry.organizationName} />
                    {liveEntry.valetName ? <InfoRow label="Valet" value={liveEntry.valetName} /> : null}
                  </div>

                  {liveEntry.status === 'PARKED' ? (
                    <Button
                      size="lg"
                      className="h-14 w-full bg-zinc-900 text-base font-bold tracking-wide text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                      onClick={() => requestPickup.mutate()}
                      loading={requestPickup.isPending}
                    >
                      <KeyRound className="size-5" /> GET MY CAR
                    </Button>
                  ) : null}

                  {liveEntry.status === 'PICKUP_REQUESTED' || liveEntry.status === 'PICKUP_IN_PROGRESS' ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/60 py-3 text-sm text-muted-foreground">
                      <span className="relative flex size-2.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
                      </span>
                      Live — updates automatically
                    </div>
                  ) : null}

                  {liveEntry.status === 'COMPLETED' ? (
                    <Button size="lg" variant="outline" className="w-full" onClick={resetFlow}>
                      Park another vehicle
                    </Button>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold">WeePark</span> · Smart Parking Management
        </p>
      </div>
    </div>
  );
}
