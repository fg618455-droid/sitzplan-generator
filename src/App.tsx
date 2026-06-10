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
import { Users, Shuffle, Trash2, UserPlus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

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

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all z-10",
        isDragging && "opacity-50 ring-2 ring-blue-500 z-50"
      )}
    >
      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Users size={14} className="text-blue-600" />
      </div>
      <span className="font-medium text-sm truncate">{student.name}</span>
    </div>
  );
}

function Seat({ id, student }: { id: string; student?: Student }) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col items-center justify-center w-full aspect-square md:aspect-video rounded-xl border-2 transition-all",
        isOver ? "border-blue-500 bg-blue-50" : "border-dashed border-slate-300 bg-slate-100/50",
        student ? "border-solid border-slate-200 bg-white shadow-sm" : ""
      )}
    >
      <span className="absolute top-2 left-2 text-xs font-bold text-slate-400">
        {id.replace('seat-', '')}
      </span>
      {student ? (
        <DraggableStudent student={student} />
      ) : (
        <span className="text-slate-400 text-sm">Leer</span>
      )}
    </div>
  );
}

function Waitlist({ students }: { students: Student[] }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'waitlist',
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Users size={18} className="text-slate-500" />
          Warteliste
        </h2>
        <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
          {students.length}
        </span>
      </div>
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-4 overflow-y-auto flex flex-col gap-2 min-h-[150px] transition-colors",
          isOver && "bg-blue-50/50"
        )}
      >
        {students.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm text-center">
            Keine Schüler in der Warteliste.<br />Füge neue hinzu oder setze den Plan zurück.
          </div>
        ) : (
          students.map(student => (
            <DraggableStudent key={student.id} student={student} />
          ))
        )}
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('sitzplan-students');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved students', e);
      }
    }
    return [];
  });
  
  useEffect(() => {
    localStorage.setItem('sitzplan-students', JSON.stringify(students));
  }, [students]);

  const [newName, setNewName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const addStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || students.length >= 30) return;

    // Mehrere Namen durch Komma oder Zeilenumbruch trennen
    const names = newName.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '');
    
    setStudents(prev => {
      let currentStudents = [...prev];
      for (const name of names) {
        if (currentStudents.length >= 30) break;
        currentStudents.push({
          id: `student-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          name: name,
          seatId: null,
        });
      }
      return currentStudents;
    });
    setNewName('');
  };

  const removeAll = () => {
    if(window.confirm('Möchtest du wirklich alle Schüler entfernen?')) {
      setStudents([]);
    }
  };

  const resetSeats = () => {
    setStudents(students.map(s => ({ ...s, seatId: null })));
  };

  const distributeRandomly = () => {
    setStudents(prev => {
      // Berechne, wer schon sitzt und wer noch auf der Warteliste ist
      const seatedStudents = prev.filter(s => s.seatId !== null);
      const unseatedStudents = prev.filter(s => s.seatId === null);
      
      // Mische die Wartelisten-Schüler
      let shuffledUnseated = [...unseatedStudents].sort(() => Math.random() - 0.5);
      
      // Finde alle leeren Plätze (5x6 Grid war vorher, jetzt 32 Plätze im 3-2-3 Layout)
      const allSeats = Array.from({length: 32}, (_, i) => `seat-${i + 1}`);
      const occupiedSeats = new Set(seatedStudents.map(s => s.seatId));
      const emptySeats = allSeats.filter(seatId => !occupiedSeats.has(seatId));
      
      // Mische die leeren Plätze
      let shuffledEmptySeats = [...emptySeats].sort(() => Math.random() - 0.5);

      // Verteile die ungesetzten Schüler auf die leeren Plätze
      const newlySeatedStudents = shuffledUnseated.map((student, index) => {
        return {
          ...student,
          seatId: index < shuffledEmptySeats.length ? shuffledEmptySeats[index] : null
        };
      });

      return [...seatedStudents, ...newlySeatedStudents];
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const studentId = active.id as string;
    const targetId = over.id as string;

    setStudents(prev => {
      const newStudents = [...prev];
      const studentIndex = newStudents.findIndex(s => s.id === studentId);
      if (studentIndex === -1) return prev;

      const currentSeatId = newStudents[studentIndex].seatId;

      if (targetId === 'waitlist') {
        newStudents[studentIndex] = { ...newStudents[studentIndex], seatId: null };
      } else {
        // target is a seat
        const existingStudentIndex = newStudents.findIndex(s => s.seatId === targetId);
        
        if (existingStudentIndex !== -1 && existingStudentIndex !== studentIndex) {
          // Swap seats
          newStudents[existingStudentIndex] = { ...newStudents[existingStudentIndex], seatId: currentSeatId };
        }
        newStudents[studentIndex] = { ...newStudents[studentIndex], seatId: targetId };
      }

      return newStudents;
    });
  };

  const activeStudent = activeId ? students.find(s => s.id === activeId) : null;
  const waitlistStudents = students.filter(s => s.seatId === null);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Controls */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Sitzplan Generator</h1>
              <p className="text-slate-500 text-sm mt-1">
                Füge bis zu 30 Schüler hinzu und verteile sie auf die Plätze.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={resetSeats}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
              >
                Zurücksetzen
              </button>
              <button
                onClick={distributeRandomly}
                disabled={students.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <Shuffle size={16} />
                Zufällig verteilen
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <form onSubmit={addStudent} className="flex-1 flex gap-2 w-full">
              <div className="flex-1">
                <label htmlFor="nameInput" className="sr-only">Schülername</label>
                <textarea
                  id="nameInput"
                  rows={2}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addStudent(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Namen der Schüler eingeben (durch Komma oder Zeilenumbruch trennen)..."
                  disabled={students.length >= 30}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={!newName.trim() || students.length >= 30}
                className="px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0 h-fit mt-1"
              >
                <UserPlus size={18} />
                <span className="hidden sm:inline">Klasse hinzufügen</span>
              </button>
            </form>
            
            <button
              onClick={removeAll}
              disabled={students.length === 0}
              className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 mt-1"
              title="Alle Schüler löschen"
            >
              <Trash2 size={20} />
            </button>
          </div>
          {students.length >= 30 && (
            <p className="text-amber-500 text-sm mt-2 font-medium">
              Maximale Anzahl von 30 Schülern erreicht.
            </p>
          )}
        </div>

        {/* Main Content Area */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Sidebar: Waitlist */}
            <div className="lg:col-span-1 flex flex-col h-[600px] lg:h-auto">
              <Waitlist students={waitlistStudents} />
            </div>

            {/* Main: Seating Grid */}
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="flex justify-start mb-8">
                  <div className="px-8 py-3 bg-slate-800 text-white font-semibold rounded-lg shadow-md flex items-center gap-2">
                    Lehrerpult
                  </div>
                </div>

                <div className="grid grid-cols-10 gap-2 md:gap-3">
                  {(() => {
                    let seatCounter = 1;
                    const cells = [];
                    for (let row = 0; row < 4; row++) {
                      for (let col = 0; col < 10; col++) {
                        // Gänge (Aisles) bei Index 3 und 6
                        if (col === 3 || col === 6) {
                          cells.push(<div key={`aisle-${row}-${col}`} className="w-full" />);
                        } else {
                          // Sitzplätze bis 32 (für perfekte Symmetrie)
                          if (seatCounter <= 32) {
                            const seatId = `seat-${seatCounter}`;
                            const student = students.find(s => s.seatId === seatId);
                            cells.push(<Seat key={seatId} id={seatId} student={student} />);
                            seatCounter++;
                          } else {
                            cells.push(<div key={`empty-${row}-${col}`} className="w-full" />);
                          }
                        }
                      }
                    }
                    return cells;
                  })()}
                </div>
              </div>
            </div>

          </div>

          <DragOverlay dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}>
            {activeStudent ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-400 rounded-lg shadow-xl cursor-grabbing ring-2 ring-blue-500 opacity-90 rotate-2 scale-105">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users size={14} className="text-blue-600" />
                </div>
                <span className="font-medium text-sm">{activeStudent.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

      </div>
    </div>
  );
}
