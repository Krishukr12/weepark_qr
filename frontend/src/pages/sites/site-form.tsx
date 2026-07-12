import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sitesApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/shared/form-field';
import type { Site } from '@/types';

const siteSchema = z.object({
  name: z.string().min(2, 'Site name is too short'),
  address: z.string().min(4, 'Address is too short'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  googleMapsLink: z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  totalCapacity: z.coerce.number<number>().int().min(1, 'Capacity must be at least 1'),
  isActive: z.boolean(),
});

type SiteForm = z.infer<typeof siteSchema>;

interface SiteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: Site | null;
}

export function SiteFormDialog({ open, onOpenChange, site }: SiteFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(site);

  const form = useForm<SiteForm>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: '', address: '', latitude: '', longitude: '', googleMapsLink: '', totalCapacity: 50, isActive: true },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: site?.name ?? '',
        address: site?.address ?? '',
        latitude: site?.latitude?.toString() ?? '',
        longitude: site?.longitude?.toString() ?? '',
        googleMapsLink: site?.googleMapsLink ?? '',
        totalCapacity: site?.totalCapacity ?? 50,
        isActive: site?.isActive ?? true,
      });
    }
  }, [open, site, form]);

  const mutation = useMutation({
    mutationFn: (values: SiteForm) => {
      const payload = {
        name: values.name,
        address: values.address,
        latitude: values.latitude ? Number(values.latitude) : null,
        longitude: values.longitude ? Number(values.longitude) : null,
        googleMapsLink: values.googleMapsLink || null,
        totalCapacity: values.totalCapacity,
        isActive: values.isActive,
      };
      return isEditing && site ? sitesApi.update(site.id, payload) : sitesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Site updated' : 'Site created — QR code generated');
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit site' : 'Create site'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the site details below.'
              : 'A unique site code and QR code are generated automatically.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <FormField label="Site name" htmlFor="name" error={form.formState.errors.name?.message} required>
            <Input id="name" placeholder="Tower A — Basement Parking" {...form.register('name')} />
          </FormField>
          <FormField label="Address" htmlFor="address" error={form.formState.errors.address?.message} required>
            <Input id="address" placeholder="12 MG Road, Bengaluru" {...form.register('address')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Latitude" htmlFor="latitude" error={form.formState.errors.latitude?.message}>
              <Input id="latitude" placeholder="12.9716" inputMode="decimal" {...form.register('latitude')} />
            </FormField>
            <FormField label="Longitude" htmlFor="longitude" error={form.formState.errors.longitude?.message}>
              <Input id="longitude" placeholder="77.5946" inputMode="decimal" {...form.register('longitude')} />
            </FormField>
          </div>
          <FormField label="Google Maps link" htmlFor="googleMapsLink" error={form.formState.errors.googleMapsLink?.message}>
            <Input id="googleMapsLink" placeholder="https://maps.google.com/…" {...form.register('googleMapsLink')} />
          </FormField>
          <div className="grid grid-cols-2 items-end gap-4">
            <FormField label="Total capacity" htmlFor="totalCapacity" error={form.formState.errors.totalCapacity?.message} required>
              <Input id="totalCapacity" type="number" min={1} {...form.register('totalCapacity')} />
            </FormField>
            <div className="flex items-center gap-3 pb-2">
              <Switch
                id="isActive"
                checked={form.watch('isActive')}
                onCheckedChange={(checked) => form.setValue('isActive', checked)}
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Create site'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
