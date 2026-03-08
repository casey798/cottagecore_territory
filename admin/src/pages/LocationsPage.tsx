import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  toggleLocationActive,
} from '@/api/locations';
import { DataTable, type Column } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField } from '@/components/FormField';
import { Toggle } from '@/components/Toggle';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { MapLocationPicker } from '@/components/MapLocationPicker';
import type { Location, LocationCategory } from '@/types';

const CATEGORIES: LocationCategory[] = [
  'courtyard',
  'corridor',
  'garden',
  'classroom',
  'other',
];

function useNotification() {
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function notify(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  return { notification, notify };
}

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.enum(['courtyard', 'corridor', 'garden', 'classroom', 'other']),
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
  geofenceRadius: z.number().min(5).max(100),
  chestDropModifier: z.number().min(0).max(5),
  notes: z.string().optional(),
});

type LocationForm = z.infer<typeof locationSchema>;

const EMPTY_FORM: LocationForm = {
  name: '',
  category: 'courtyard',
  gpsLat: 0,
  gpsLng: 0,
  geofenceRadius: 15,
  chestDropModifier: 1.0,
  notes: '',
};

export function LocationsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { notification, notify } = useNotification();

  const { data: locations, isLoading, error } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
  });

  const createMut = useMutation({
    mutationFn: createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      closeModal();
      notify('success', 'Location created successfully.');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Location> }) =>
      updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      closeModal();
      notify('success', 'Location updated successfully.');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setDeleteTarget(null);
      notify('success', 'Location deleted.');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleLocationActive(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      notify('success', 'Location status updated.');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(loc: Location) {
    setForm({
      name: loc.name,
      category: loc.category,
      gpsLat: loc.gpsLat,
      gpsLng: loc.gpsLng,
      geofenceRadius: loc.geofenceRadius,
      chestDropModifier: loc.chestDropModifier,
      notes: loc.notes || '',
    });
    setEditingId(loc.locationId);
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = locationSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (editingId) {
      updateMut.mutate({ id: editingId, data: result.data });
    } else {
      createMut.mutate({ ...result.data, active: true });
    }
  }

  function updateField(key: keyof LocationForm, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const columns: Column<Location>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (l) => l.name,
      sortable: true,
      sortValue: (l) => l.name,
    },
    {
      key: 'category',
      header: 'Category',
      render: (l) => (
        <span className="capitalize">{l.category}</span>
      ),
      sortable: true,
      sortValue: (l) => l.category,
    },
    {
      key: 'gps',
      header: 'GPS',
      render: (l) => `${l.gpsLat.toFixed(6)}, ${l.gpsLng.toFixed(6)}`,
    },
    {
      key: 'radius',
      header: 'Radius',
      render: (l) => `${l.geofenceRadius}m`,
      sortable: true,
      sortValue: (l) => l.geofenceRadius,
    },
    {
      key: 'chestMod',
      header: 'Chest Mod',
      render: (l) => `${l.chestDropModifier}x`,
    },
    {
      key: 'active',
      header: 'Active',
      render: (l) => (
        <Toggle
          checked={l.active}
          onChange={(active) =>
            toggleMut.mutate({ id: l.locationId, active })
          }
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (l) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEdit(l)}
            className="text-sm text-[#8B6914] hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteTarget(l)}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">Locations</h1>
        <button
          onClick={openCreate}
          className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210]"
        >
          + Add Location
        </button>
      </div>

      {notification && (
        <div
          className={`mb-4 rounded p-3 text-sm ${
            notification.type === 'success'
              ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert message={(error as Error).message} />}

      {locations && (
        <DataTable
          data={locations}
          columns={columns}
          keyExtractor={(l) => l.locationId}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Location' : 'Add Location'}
        maxWidth="720px"
      >
        <form onSubmit={handleSubmit}>
          <FormField
            label="Name"
            value={form.name}
            onChange={(e) =>
              updateField('name', (e.target as HTMLInputElement).value)
            }
            error={errors.name}
          />
          <FormField label="Category" error={errors.category}>
            <select
              value={form.category}
              onChange={(e) =>
                updateField('category', e.target.value)
              }
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <MapLocationPicker
            lat={form.gpsLat}
            lng={form.gpsLng}
            geofenceRadius={form.geofenceRadius}
            onCoordinateChange={(lat, lng) => {
              setForm((f) => ({ ...f, gpsLat: lat, gpsLng: lng }));
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Latitude"
              type="number"
              step="0.000001"
              value={form.gpsLat}
              onChange={(e) =>
                updateField(
                  'gpsLat',
                  parseFloat((e.target as HTMLInputElement).value) || 0,
                )
              }
              error={errors.gpsLat}
            />
            <FormField
              label="Longitude"
              type="number"
              step="0.000001"
              value={form.gpsLng}
              onChange={(e) =>
                updateField(
                  'gpsLng',
                  parseFloat((e.target as HTMLInputElement).value) || 0,
                )
              }
              error={errors.gpsLng}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Geofence Radius (m)"
              type="number"
              min={5}
              max={100}
              value={form.geofenceRadius}
              onChange={(e) =>
                updateField(
                  'geofenceRadius',
                  parseInt((e.target as HTMLInputElement).value) || 15,
                )
              }
              error={errors.geofenceRadius}
            />
            <FormField
              label="Chest Drop Modifier"
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={form.chestDropModifier}
              onChange={(e) =>
                updateField(
                  'chestDropModifier',
                  parseFloat((e.target as HTMLInputElement).value) || 1.0,
                )
              }
              error={errors.chestDropModifier}
            />
          </div>
          <FormField
            as="textarea"
            label="Notes"
            value={form.notes}
            onChange={(e) =>
              updateField('notes', (e.target as HTMLTextAreaElement).value)
            }
            rows={3}
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="rounded bg-gray-200 px-4 py-2 text-sm text-[#3D2B1F] hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending || updateMut.isPending}
              className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
            >
              {editingId ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.locationId);
        }}
        title="Delete Location"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
}
