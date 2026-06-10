import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';

// Types
type Student = {
  id: string;
  name: string;
  seatId: string | null;
};

// --- Components ---

function DraggableStudent({ student }: { student: Student }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
    data: student,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing select-none text-base text-center truncate"
    >
      {student.name}
    </div>
  );
}

function Seat({ id, student }: { id: string; student?: Student }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <td
      ref={setNodeRef}
      className={`border-2 border-gray-400 h-16 min-w-[120px] text-center text-base px-2 ${
        isOver ? 'bg-blue-100' : student ? 'bg-white' : 'bg-gray-50'
      }`}
    >
      {student ? (
        <DraggableStudent student={student} />
      ) : (
        <span className="text-gray-300 text-sm">{id.replace('seat-', '')}</span>
      )}
    </td>
  );
}

function WaitlistDropzone({ students }: { students: Student[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'waitlist' });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-gray-400 p-3 min-h-[60px] ${isOver ? 'bg-blue-50' : 'bg-white'}`}
    >
      {students.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-2">Keine Schüler in der Warteliste</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {students.map(s => (
            <div key={s.id} className="border border-gray-300 px-3 py-1 text-sm bg-white">
              <DraggableStudent student={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('sitzplan-students');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('sitzplan-students', JSON.stringify(students));
  }, [students]);

  const [newName, setNewName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const addStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || students.length >= 30) return;
    const names = newName.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '');
    setStudents(prev => {
      const next = [...prev];
      for (const name of names) {
        if (next.length >= 30) break;
        next.push({
          id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name,
          seatId: null,
        });
      }
      return next;
    });
    setNewName('');
  };

  const removeAll = () => {
    if (window.confirm('Alle Schüler entfernen?')) setStudents([]);
  };

  const resetSeats = () => {
    setStudents(prev => prev.map(s => ({ ...s, seatId: null })));
  };

  const distributeRandomly = () => {
    setStudents(prev => {
      const seated = prev.filter(s => s.seatId !== null);
      const unseated = [...prev.filter(s => s.seatId === null)].sort(() => Math.random() - 0.5);
      const allSeats = Array.from({ length: 32 }, (_, i) => `seat-${i + 1}`);
      const taken = new Set(seated.map(s => s.seatId));
      const free = allSeats.filter(id => !taken.has(id)).sort(() => Math.random() - 0.5);
      const placed = unseated.map((s, i) => ({ ...s, seatId: i < free.length ? free[i] : null }));
      return [...seated, ...placed];
    });
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const sid = active.id as string;
    const tid = over.id as string;
    setStudents(prev => {
      const next = [...prev];
      const si = next.findIndex(s => s.id === sid);
      if (si === -1) return prev;
      const cur = next[si].seatId;
      if (tid === 'waitlist') {
        next[si] = { ...next[si], seatId: null };
      } else {
        const ei = next.findIndex(s => s.seatId === tid);
        if (ei !== -1 && ei !== si) next[ei] = { ...next[ei], seatId: cur };
        next[si] = { ...next[si], seatId: tid };
      }
      return next;
    });
  };

  const activeStudent = activeId ? students.find(s => s.id === activeId) : null;
  const waitlistStudents = students.filter(s => s.seatId === null);

  // Build 4 rows, each: 3 seats | gap | 2 seats | gap | 3 seats
  const rows: string[][] = [];
  let counter = 1;
  for (let r = 0; r < 4; r++) {
    const row: string[] = [];
    for (let c = 0; c < 8; c++) {
      row.push(`seat-${counter}`);
      counter++;
    }
    rows.push(row);
  }

  return (
    <div className="min-h-screen bg-white p-6 md:p-10" style={{ fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      <div className="max-w-6xl mx-auto">

        <h1 className="text-2xl font-bold mb-6 border-b-2 border-gray-400 pb-3">Sitzplan Generator</h1>

        {/* Controls - hidden when printing */}
        <div className="no-print flex flex-wrap gap-3 mb-6 items-start">
          <form onSubmit={addStudent} className="flex gap-3 flex-1 min-w-[300px]">
            <textarea
              rows={2}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addStudent(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Namen eingeben (Komma oder Zeilenumbruch)..."
              disabled={students.length >= 30}
              className="flex-1 border-2 border-gray-400 px-3 py-2 text-base resize-none focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!newName.trim() || students.length >= 30}
              className="border-2 border-gray-400 px-4 py-2 text-base bg-gray-100 hover:bg-gray-200 disabled:opacity-40 h-fit font-medium"
            >
              Hinzufügen
            </button>
          </form>
          <button onClick={distributeRandomly} disabled={waitlistStudents.length === 0}
            className="border-2 border-gray-400 px-4 py-2 text-base bg-gray-100 hover:bg-gray-200 disabled:opacity-40 font-medium">
            ↻ Zufällig verteilen
          </button>
          <button onClick={resetSeats}
            className="border-2 border-gray-400 px-4 py-2 text-base bg-gray-100 hover:bg-gray-200 font-medium">
            Zurücksetzen
          </button>
          <button onClick={removeAll} disabled={students.length === 0}
            className="border-2 border-gray-400 px-4 py-2 text-base bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-40 font-medium">
            Alle löschen
          </button>
          <button onClick={() => window.print()}
            className="border-2 border-gray-400 px-4 py-2 text-base bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium">
            🖨 Drucken
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Warteliste */}
          <div className="mb-6 no-print">
            <div className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wide">
              Warteliste ({waitlistStudents.length})
            </div>
            <WaitlistDropzone students={waitlistStudents} />
          </div>

          {/* Sitzplan Table */}
          <div className="overflow-x-auto" id="sitzplan">
            <div className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">
              Sitzplan
            </div>

            <table className="border-collapse border-2 border-gray-400 mb-4">
              <tbody>
                {/* Lehrerpult row */}
                <tr>
                  <td colSpan={3} className="border-2 border-gray-400 bg-gray-300 text-center text-base font-bold py-3 px-4">
                    Lehrerpult
                  </td>
                  <td className="border-0 w-8"></td>
                  <td colSpan={2} className="border-2 border-gray-400 bg-gray-100"></td>
                  <td className="border-0 w-8"></td>
                  <td colSpan={3} className="border-2 border-gray-400 bg-gray-100"></td>
                </tr>

                {/* Spacer row */}
                <tr>
                  <td colSpan={3} className="border-0 h-4"></td>
                  <td className="border-0 w-8"></td>
                  <td colSpan={2} className="border-0 h-4"></td>
                  <td className="border-0 w-8"></td>
                  <td colSpan={3} className="border-0 h-4"></td>
                </tr>

                {/* Seat rows */}
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {/* Left block: 3 seats */}
                    {row.slice(0, 3).map(seatId => (
                      <Seat key={seatId} id={seatId} student={students.find(s => s.seatId === seatId)} />
                    ))}
                    {/* Aisle */}
                    <td className="border-0 w-8 bg-white"></td>
                    {/* Middle block: 2 seats */}
                    {row.slice(3, 5).map(seatId => (
                      <Seat key={seatId} id={seatId} student={students.find(s => s.seatId === seatId)} />
                    ))}
                    {/* Aisle */}
                    <td className="border-0 w-8 bg-white"></td>
                    {/* Right block: 3 seats */}
                    {row.slice(5, 8).map(seatId => (
                      <Seat key={seatId} id={seatId} student={students.find(s => s.seatId === seatId)} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DragOverlay>
            {activeStudent ? (
              <div className="border-2 border-blue-500 bg-white px-3 py-2 text-base shadow-sm">
                {activeStudent.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

      </div>
    </div>
  );
}
