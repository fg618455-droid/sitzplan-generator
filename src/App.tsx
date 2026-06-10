import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';

type Student = { id: string; name: string; seatId: string | null };

function Draggable({ student }: { student: Student }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id, data: student,
  });
  const style: React.CSSProperties = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <span ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="cursor-grab active:cursor-grabbing select-none">
      {student.name}
    </span>
  );
}

function Cell({ id, student }: { id: string; student?: Student }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <td ref={setNodeRef} style={{
      border: '2px solid #999', height: 50, minWidth: 110, textAlign: 'center',
      fontSize: 15, background: isOver ? '#dbeafe' : student ? '#fff' : '#f9f9f9',
    }}>
      {student ? <Draggable student={student} /> : <span style={{ color: '#ccc' }}>{id.replace('seat-', '')}</span>}
    </td>
  );
}

export default function App() {
  const [students, setStudents] = useState<Student[]>(() => {
    try { return JSON.parse(localStorage.getItem('sp') || '[]'); } catch { return []; }
  });
  const [txt, setTxt] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('sp', JSON.stringify(students)); }, [students]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txt.trim()) return;
    const names = txt.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
    setStudents(p => {
      const n = [...p];
      for (const name of names) { if (n.length >= 30) break; n.push({ id: `${Date.now()}-${Math.random()}`, name, seatId: null }); }
      return n;
    });
    setTxt('');
  };

  const shuffle = () => {
    setStudents(p => {
      const all = [...p].sort(() => Math.random() - 0.5);
      const seats = Array.from({ length: 32 }, (_, i) => `seat-${i + 1}`).sort(() => Math.random() - 0.5);
      return all.map((s, i) => ({ ...s, seatId: i < seats.length ? seats[i] : null }));
    });
  };

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const sid = e.active.id as string, tid = e.over.id as string;
    setStudents(p => {
      const n = [...p]; const si = n.findIndex(s => s.id === sid); if (si === -1) return p;
      const cur = n[si].seatId;
      if (tid === 'waitlist') { n[si] = { ...n[si], seatId: null }; }
      else { const ei = n.findIndex(s => s.seatId === tid); if (ei !== -1 && ei !== si) n[ei] = { ...n[ei], seatId: cur }; n[si] = { ...n[si], seatId: tid }; }
      return n;
    });
  };

  const wait = students.filter(s => !s.seatId);
  const active = activeId ? students.find(s => s.id === activeId) : null;
  const { isOver: wlOver, setNodeRef: wlRef } = useDroppable({ id: 'waitlist' });

  const rows: string[][] = [];
  let c = 1;
  for (let r = 0; r < 4; r++) { const row: string[] = []; for (let i = 0; i < 8; i++) { row.push(`seat-${c++}`); } rows.push(row); }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 30, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20, borderBottom: '2px solid #333', paddingBottom: 10 }}>Sitzplan</h1>

      {/* Buttons */}
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <form onSubmit={add} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 250 }}>
          <textarea rows={2} value={txt} onChange={e => setTxt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(e as unknown as React.FormEvent); } }}
            placeholder="Namen (Komma oder Zeilenumbruch)..."
            style={{ flex: 1, border: '1px solid #999', padding: '6px 10px', fontSize: 14, resize: 'none' }} />
          <button type="submit" style={{ border: '1px solid #999', padding: '6px 14px', fontSize: 14, background: '#eee', cursor: 'pointer' }}>
            Hinzufügen
          </button>
        </form>
        <button onClick={shuffle} style={{ border: '1px solid #999', padding: '6px 14px', fontSize: 14, background: '#eee', cursor: 'pointer' }}>Neu mischen</button>
        <button onClick={() => setStudents(p => p.map(s => ({ ...s, seatId: null })))} style={{ border: '1px solid #999', padding: '6px 14px', fontSize: 14, background: '#eee', cursor: 'pointer' }}>Zurücksetzen</button>
        <button onClick={() => { if (confirm('Alle löschen?')) setStudents([]); }} style={{ border: '1px solid #999', padding: '6px 14px', fontSize: 14, background: '#fee', color: '#c00', cursor: 'pointer' }}>Löschen</button>
        <button onClick={() => window.print()} style={{ border: '1px solid #999', padding: '6px 14px', fontSize: 14, background: '#e8f0fe', color: '#1a56db', cursor: 'pointer' }}>🖨 Drucken</button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onEnd}>

        {/* Warteliste */}
        <div className="no-print" style={{ marginBottom: 20 }}>
          <b style={{ fontSize: 13, color: '#666' }}>Warteliste ({wait.length})</b>
          <div ref={wlRef} style={{
            border: '1px solid #999', padding: 8, minHeight: 40, marginTop: 4,
            background: wlOver ? '#e8f0fe' : '#fff', display: 'flex', flexWrap: 'wrap', gap: 6,
          }}>
            {wait.length === 0
              ? <span style={{ color: '#bbb', fontSize: 13 }}>Leer</span>
              : wait.map(s => (
                <span key={s.id} style={{ border: '1px solid #ccc', padding: '3px 10px', fontSize: 14, background: '#fff' }}>
                  <Draggable student={s} />
                </span>
              ))
            }
          </div>
        </div>

        {/* Tabelle */}
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td colSpan={3} style={{ border: '2px solid #999', background: '#ddd', textAlign: 'center', fontWeight: 'bold', fontSize: 15, padding: 10 }}>Lehrerpult</td>
              <td style={{ width: 30 }}></td>
              <td colSpan={2} style={{ border: '2px solid #999', background: '#f5f5f5' }}></td>
              <td style={{ width: 30 }}></td>
              <td colSpan={3} style={{ border: '2px solid #999', background: '#f5f5f5' }}></td>
            </tr>
            <tr><td colSpan={10} style={{ height: 12 }}></td></tr>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.slice(0, 3).map(id => <Cell key={id} id={id} student={students.find(s => s.seatId === id)} />)}
                <td style={{ width: 30 }}></td>
                {row.slice(3, 5).map(id => <Cell key={id} id={id} student={students.find(s => s.seatId === id)} />)}
                <td style={{ width: 30 }}></td>
                {row.slice(5, 8).map(id => <Cell key={id} id={id} student={students.find(s => s.seatId === id)} />)}
              </tr>
            ))}
          </tbody>
        </table>

        <DragOverlay>
          {active ? <span style={{ border: '2px solid #3b82f6', background: '#fff', padding: '4px 12px', fontSize: 15 }}>{active.name}</span> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
