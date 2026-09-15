'use client';

import { useMemo, useState } from 'react';
import { towerInventory, type Unit, type UnitStatus } from '@/lib/property/tower-inventory';
import { cn } from '@/lib/utils/cn';

const STATUS_STYLE: Record<UnitStatus, string> = {
  Available: 'text-gold border-gold/40',
  Reserved: 'text-mist border-alabaster/30',
  Sold: 'text-stone border-alabaster/15',
};

type InventoryPanelProps = {
  activeFloor: number | null;
  onSelect: (unit: Unit) => void;
  className?: string;
};

/**
 * The unit list, styled after `SpaceRail`'s schedule — a hairline index
 * rather than a grid of cards, so it sits in the same caption band the
 * guided tour's step list already occupies. Filterable by floor because the
 * tower is fourteen residences deep and a flat list that long makes every
 * other floor scroll past unread.
 */
export function InventoryPanel({ activeFloor, onSelect, className }: InventoryPanelProps) {
  const units = useMemo(() => towerInventory(), []);
  const floors = useMemo(() => units.map((unit) => unit.floor), [units]);
  const [filter, setFilter] = useState<number | 'all'>('all');

  const visible = filter === 'all' ? units : units.filter((unit) => unit.floor === filter);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-eyebrow text-stone uppercase">Inventory</h2>
        <label className="flex items-center gap-2">
          <span className="text-eyebrow text-stone uppercase">Floor</span>
          <select
            value={filter}
            onChange={(event) => {
              const value = event.target.value;
              setFilter(value === 'all' ? 'all' : Number(value));
            }}
            className="border-alabaster/30 text-alabaster focus-visible:outline-gold bg-obsidian/60 h-9 border px-2 text-xs uppercase tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="all">All</option>
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="border-alabaster/10 flex max-h-72 flex-col overflow-y-auto border-t">
        {visible.map((unit) => {
          const active = unit.floor === activeFloor;

          return (
            <li key={unit.id} className="border-alabaster/10 border-b">
              <button
                type="button"
                onClick={() => onSelect(unit)}
                aria-current={active ? 'true' : undefined}
                data-cursor="link"
                className={cn(
                  'group ease-luxe flex min-h-11 w-full items-center justify-between gap-4 py-2.5 text-left',
                  'transition-colors duration-300',
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'ease-luxe h-px shrink-0 transition-all duration-500',
                      active
                        ? 'bg-gold w-7'
                        : 'bg-alabaster/30 group-hover:bg-gold w-3 group-hover:w-7',
                    )}
                  />
                  <span
                    className={cn(
                      'font-sans text-sm transition-colors duration-300',
                      active ? 'text-alabaster' : 'text-mist group-hover:text-alabaster',
                    )}
                  >
                    Unit {unit.id}
                  </span>
                  <span className="text-stone text-xs tabular-nums">
                    {unit.beds} bed · {unit.baths} bath · {unit.sqft.toLocaleString()} sqft
                  </span>
                </span>
                <span
                  className={cn(
                    'text-eyebrow shrink-0 border px-2 py-1 uppercase tabular-nums',
                    STATUS_STYLE[unit.status],
                  )}
                >
                  {unit.status}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default InventoryPanel;
