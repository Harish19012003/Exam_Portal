import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Icon } from '@iconify/react';
import type { AttachmentItem, CellEditorProps } from '../types';
import { editorBase } from './shared';

export function AttachmentEditor({ value, onSave, isDarkMode, autoFocus }: CellEditorProps) {
  const parseInitial = () => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return (value as AttachmentItem[]).map(item => ({
        ...item,
        addedAt: item.addedAt || (Date.now() - 86400000) // Fallback to 1 day ago for legacy data
      }));
    }
    if (typeof value === 'string') {
      return [{ 
        id: 'init-1', 
        name: value.split('/').pop() || 'Attachment', 
        url: value, 
        type: value.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? 'image' : 'file',
        addedAt: Date.now() - 86400000
      }] as AttachmentItem[];
    }
    return [];
  };

  const [val, setVal] = useState<AttachmentItem[]>(parseInitial);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(!!autoFocus);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
  }, []);

  const handleSave = () => {
    setIsOpen(false);
    onSave(val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: AttachmentItem[] = files.map(f => ({
      id: Math.random().toString(36).substring(7),
      name: f.name,
      url: URL.createObjectURL(f),
      type: f.type.startsWith('image/') ? 'image' : 'file',
      size: f.size,
      addedAt: Date.now()
    }));
    setVal(prev => [...prev, ...newItems]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) {
      setShowUrlInput(false);
      return;
    }
    const isImg = urlInput.match(/\.(jpeg|jpg|gif|png|webp)$/i);
    setVal(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      name: urlInput.split('/').pop() || 'Linked File',
      url: urlInput.trim(),
      type: isImg ? 'image' : 'file',
      addedAt: Date.now()
    }]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative outline-none" tabIndex={-1}>
      <div 
        className={`${editorBase(isDarkMode)} flex items-center justify-between cursor-pointer`}
        tabIndex={0}
        onClick={() => { setIsOpen(true); if (containerRef.current) setRect(containerRef.current.getBoundingClientRect()); }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
            if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
          }
        }}
      >
        <span className="truncate">{val.length} Attachment{val.length !== 1 ? 's' : ''}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>

      {isOpen && rect && createPortal(
        <div 
          className="dropdown-portal fixed z-[9999]" 
          style={{ 
            top: rect.bottom + 4, 
            left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 300) - 16), 
            width: Math.max(rect.width, 300) 
          }}
        >
          <div className="fixed inset-0" onClick={handleSave} />
          
          <div className={`relative flex flex-col rounded-xl border shadow-xl overflow-hidden ${isDarkMode ? 'bg-[#0B1E19] border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`p-3 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
              <span className={`text-[13px] font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Attachments</span>
              <div className="flex items-center gap-3">
                {val.length > 1 && (
                  <button 
                    onClick={() => setVal([])} 
                    className={`text-[12px] font-medium transition-colors ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}
                  >
                    Clear All
                  </button>
                )}
                <button onClick={handleSave} className={`text-[12px] font-medium px-2 py-1 rounded-md bg-[#13C296] text-white`}>Done</button>
              </div>
            </div>

            <div className="max-h-[250px] overflow-y-auto p-2 flex flex-col gap-2">
              {val.length === 0 && (
                <div className={`text-center py-4 text-[12px] italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No attachments yet</div>
              )}
              {val.map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-2 rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-100 bg-white'}`}>
                  {item.type === 'image' ? (
                    <img src={item.url} alt="" className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700" />
                  ) : (
                    <div className={`w-10 h-10 rounded flex items-center justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <Icon icon="hugeicons:file-attachment" className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`} title={item.name}>{item.name}</div>
                    <div className={`text-[10px] truncate flex items-center gap-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span>{item.type.toUpperCase()}</span>
                      {item.addedAt && (
                        <>
                          <span className="w-[3px] h-[3px] rounded-full bg-current opacity-40"></span>
                          <span>{(() => {
                            const mins = Math.floor((Date.now() - item.addedAt) / 60000);
                            if (mins < 1) return 'Just now';
                            if (mins < 60) return `${mins}m ago`;
                            const hrs = Math.floor(mins / 60);
                            if (hrs < 24) return `${hrs}h ago`;
                            return `${Math.floor(hrs / 24)}d ago`;
                          })()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => navigator.clipboard.writeText(item.url)}
                      className={`p-1.5 rounded-md transition-all ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100'}`}
                      title="Copy Link"
                    >
                      <Icon icon="hugeicons:copy-01" className="w-4 h-4" />
                    </button>
                    <a 
                      href={item.url} target="_blank" rel="noreferrer"
                      className={`p-1.5 rounded-md transition-all flex ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100'}`}
                      title="Open in new tab"
                    >
                      <Icon icon="hugeicons:link-square-02" className="w-4 h-4" />
                    </a>
                    <button 
                      onClick={() => setVal(prev => prev.filter(v => v.id !== item.id))}
                      className={`p-1.5 rounded-md transition-all ${isDarkMode ? 'text-gray-400 hover:bg-red-900/40 hover:text-red-400' : 'text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
                      title="Delete"
                    >
                      <Icon icon="hugeicons:delete-02" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={`p-2 border-t flex flex-col gap-2 ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-100 bg-gray-50'}`}>
              {showUrlInput ? (
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    type="url" 
                    placeholder="https://..." 
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                    className={`flex-1 px-2 py-1.5 text-[12px] rounded border outline-none ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
                  />
                  <button onClick={handleAddUrl} className="px-3 py-1.5 text-[12px] font-medium rounded bg-[#13C296] text-white">Add</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="file" multiple className="hidden" ref={fileRef} onChange={handleFileUpload} />
                  <button onClick={() => fileRef.current?.click()} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold rounded-md border transition-colors ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                    <Icon icon="hugeicons:upload-01" className="w-3.5 h-3.5" />
                    Upload File
                  </button>
                  <button onClick={() => setShowUrlInput(true)} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold rounded-md border transition-colors ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                    <Icon icon="hugeicons:link-01" className="w-3.5 h-3.5" />
                    Add URL
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

