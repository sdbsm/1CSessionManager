import React, { useState } from 'react';
import { Client, SystemEvent } from '../../types';
import { TimeRange, TimeRangePreset } from '../../hooks/useTimeRange';
import { useEvents } from '../../hooks/useEvents';
import EventFilters from './components/EventFilters';
import EventTable from './components/EventTable';
import EventDetails from './components/EventDetails';
import { Modal } from '../../components/ui/Modal';

interface EventsProps {
  timeRange: TimeRange;
  timePreset: TimeRangePreset;
  setTimePreset: (preset: TimeRangePreset) => void;
  clients: Client[];
}

const Events: React.FC<EventsProps> = ({ timeRange, timePreset, setTimePreset, clients }) => {
  const {
    events,
    loading,
    isRefreshing,
    lastUpdate,
    refresh,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    filters,
    setFilterValue,
    toggleLevel,
    clearFilters,
    levelStats,
    sortField,
    sortDirection,
    toggleSort,
    handleClearEvents
  } = useEvents(timeRange);

  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  const handleCloseModal = () => setSelectedEvent(null);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-in fade-in duration-300">
      
      {/* Header Area */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-50">События</h1>
        <div className="text-sm text-slate-400">
          Журнал системных событий и ошибок
        </div>
      </div>

      {/* Main Content Card */}
      <div className="flex-1 bg-slate-950/40 border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-0 shadow-xl backdrop-blur-sm">
        
        {/* Filters Bar */}
        <EventFilters 
          filters={filters}
          setFilterValue={setFilterValue}
          toggleLevel={toggleLevel}
          levelStats={levelStats}
          clearFilters={clearFilters}
          timePreset={timePreset}
          setTimePreset={setTimePreset}
          timeRange={timeRange}
          clients={clients}
          loading={loading}
          eventCount={events.length}
          lastUpdate={lastUpdate}
          isRefreshing={isRefreshing}
          refresh={refresh}
          autoRefreshEnabled={autoRefreshEnabled}
          setAutoRefreshEnabled={setAutoRefreshEnabled}
          onClearAllEvents={handleClearEvents}
        />

        {/* Data Table */}
        <div className="flex-1 overflow-hidden relative">
            {loading && events.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-20">
                    <div className="text-slate-400 animate-pulse">Загрузка событий...</div>
                </div>
            ) : null}
            
            <EventTable 
                events={events}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={toggleSort}
                onEventClick={setSelectedEvent}
                selectedEventId={selectedEvent?.id}
            />
        </div>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={handleCloseModal}
        title="Детали события"
        size="lg"
      >
        {selectedEvent && (
            <EventDetails 
                event={selectedEvent} 
                setFilterValue={setFilterValue}
                onClose={handleCloseModal}
            />
        )}
      </Modal>

    </div>
  );
};

export default Events;
