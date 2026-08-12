<script lang="ts">
  import { ResourceTimeline } from '@urbicon-ui/blocks';
  import { addDays, isoToDate } from '@urbicon-ui/blocks/date';

  interface Booking {
    roomId: string;
    guest: string;
    /** The first night of the stay. */
    checkIn: string;
    /** The morning the guest leaves — not a night. */
    checkOut: string;
    state: 'confirmed' | 'option' | 'blocked';
  }

  const houses = [
    { id: 'cala', label: 'Cala · Menorca' },
    { id: 'firn', label: 'Firn · Engadin' }
  ];

  const rooms = [
    { id: 'cala-01', label: 'Cala 01', description: 'Garden Room', groupId: 'cala' },
    { id: 'cala-04', label: 'Cala 04', description: 'Room', groupId: 'cala' },
    { id: 'cala-07', label: 'Cala 07', description: 'Corner Room', groupId: 'cala' },
    { id: 'firn-02', label: 'Firn 02', description: 'Room', groupId: 'firn' },
    { id: 'firn-05', label: 'Firn 05', description: 'Suite', groupId: 'firn' }
  ];

  const states = [
    { id: 'confirmed', label: 'Confirmed', color: 'oklch(0.62 0.13 250)' },
    { id: 'option', label: 'Option', color: 'oklch(0.83 0.13 90)' },
    { id: 'blocked', label: 'Blocked', color: 'oklch(0.62 0.02 260)' }
  ];

  const bookings: Booking[] = [
    // Weber leaves on the 18th and Haldar arrives the same morning: the two bars
    // meet without touching. Drop the −1 below and they overlap into two rows.
    {
      roomId: 'firn-02',
      guest: 'Weber',
      checkIn: '2026-06-15',
      checkOut: '2026-06-18',
      state: 'confirmed'
    },
    {
      roomId: 'firn-02',
      guest: 'Haldar',
      checkIn: '2026-06-18',
      checkOut: '2026-06-24',
      state: 'confirmed'
    },
    {
      roomId: 'cala-01',
      guest: 'Lindqvist',
      checkIn: '2026-06-12',
      checkOut: '2026-06-18',
      state: 'confirmed'
    },
    {
      roomId: 'cala-04',
      guest: 'Bianchi',
      checkIn: '2026-06-15',
      checkOut: '2026-06-19',
      state: 'option'
    },
    {
      roomId: 'cala-07',
      guest: 'Amaral',
      checkIn: '2026-06-16',
      checkOut: '2026-07-02',
      state: 'confirmed'
    },
    {
      roomId: 'firn-05',
      guest: 'Repainting',
      checkIn: '2026-06-17',
      checkOut: '2026-06-21',
      state: 'blocked'
    }
  ];

  let picked = $state('');
</script>

<div class="w-full">
  <ResourceTimeline
    view="days"
    days={14}
    value={new Date(2026, 5, 15)}
    locale="en-US"
    resources={rooms}
    groups={houses}
    items={bookings}
    categories={states}
    getResourceId={(booking) => booking.roomId}
    getCategoryId={(booking) => booking.state}
    getLabel={(booking) => booking.guest}
    onItemClick={(booking, room) => (picked = `${booking.guest} · ${room.label}`)}
    getRange={(booking) => ({
      // Both ends are nights: the stay's last night is check-out minus one day.
      start: booking.checkIn,
      end: addDays(isoToDate(booking.checkOut), -1)
    })}
  />

  <p class="text-text-secondary mt-3 text-sm">
    {picked ? `Selected: ${picked}` : 'Pick a bar to select a stay.'}
  </p>
</div>
