import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2, Copy, Check, Save, AlertCircle, Plus, X, Edit2, Volume2 } from 'lucide-react';

interface Tab {
  id: string;
  title: string;
  content: string;
}

interface DictationCommand {
  [key: string]: string;
}

const DICTATION_COMMANDS: DictationCommand = {
  'period': '.',
  'comma': ',',
  'question mark': '?',
  'colon': ':',
  'semi colon': ';',
  'semicolon': ';',
  'exclamation mark': '!',
  'exclamation point': '!',
  'dash': '-',
  'hyphen': '-',
  'new line': '\n',
  'new paragraph': '\n\n',
  'open parentheses': '(',
  'close parentheses': ')',
  'smiley': ':-)',
  'smiley face': ':-)',
  'sad face': ':-(',
};

function App() {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showNoSpeechDetected, setShowNoSpeechDetected] = useState(false);
  const noSpeechTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechDetected = useRef<number>(Date.now());
  const activeTabRef = useRef<string>('1'); // Keep track of active tab for speech recognition

  const [tabs, setTabs] = useState<Tab[]>(() => {
    const savedTabs = document.cookie
      .split('; ')
      .find(row => row.startsWith('tabs='));
    if (savedTabs) {
      try {
        return JSON.parse(decodeURIComponent(savedTabs.split('=')[1]));
      } catch (e) {
        console.error('Error parsing saved tabs:', e);
      }
    }
    return [{ id: '1', title: 'Untitled 1', content: '' }];
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const savedActiveTab = document.cookie
      .split('; ')
      .find(row => row.startsWith('activeTab='));
    return savedActiveTab ? savedActiveTab.split('=')[1] : '1';
  });

  // Update activeTabRef whenever activeTabId changes
  useEffect(() => {
    activeTabRef.current = activeTabId;
  }, [activeTabId]);

  const [isEditingTitle, setIsEditingTitle] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  // Save tabs to cookies whenever they change
  useEffect(() => {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    document.cookie = `tabs=${encodeURIComponent(JSON.stringify(tabs))}; expires=${expiryDate.toUTCString()}; path=/`;
    document.cookie = `activeTab=${activeTabId}; expires=${expiryDate.toUTCString()}; path=/`;
  }, [tabs, activeTabId]);

  // Check for speech detection
  useEffect(() => {
    if (isListening) {
      const checkSpeechDetection = () => {
        const timeSinceLastSpeech = Date.now() - lastSpeechDetected.current;
        if (timeSinceLastSpeech > 5000) {
          setShowNoSpeechDetected(true);
          // Hide the notification after 3 seconds
          setTimeout(() => setShowNoSpeechDetected(false), 3000);
        }
      };

      noSpeechTimeout.current = setInterval(checkSpeechDetection, 1000);
    } else {
      if (noSpeechTimeout.current) {
        clearInterval(noSpeechTimeout.current);
      }
      setShowNoSpeechDetected(false);
    }

    return () => {
      if (noSpeechTimeout.current) {
        clearInterval(noSpeechTimeout.current);
      }
    };
  }, [isListening]);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const transcriptText = event.results[last][0].transcript.toLowerCase().trim();
        
        // Get the current active tab content
        const currentTab = tabs.find(tab => tab.id === activeTabRef.current);
        if (!currentTab) return;
        
        // Check if the transcript is a dictation command
        const command = DICTATION_COMMANDS[transcriptText];
        if (command) {
          setTabs(prevTabs => prevTabs.map(tab => {
            if (tab.id === activeTabRef.current) {
              let newContent = tab.content;
              // For new line/paragraph commands, ensure there's a space before them
              if (command.startsWith('\n') && newContent && !newContent.endsWith(' ')) {
                newContent = newContent + ' ' + command;
              }
              // For other punctuation, remove trailing space if it exists
              else if (newContent && newContent.endsWith(' ') && command !== ' ') {
                newContent = newContent.slice(0, -1) + command + ' ';
              }
              else {
                newContent = newContent + command + ' ';
              }
              return { ...tab, content: newContent };
            }
            return tab;
          }));
        } else {
          // Regular text - capitalize first letter if it's the start of a sentence
          let processedText = transcriptText;
          if (
            currentTab.content.endsWith('. ') || 
            currentTab.content.endsWith('! ') || 
            currentTab.content.endsWith('? ') || 
            !currentTab.content
          ) {
            processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
          }

          setTabs(prevTabs => prevTabs.map(tab => {
            if (tab.id === activeTabRef.current) {
              const newContent = tab.content + (tab.content && !tab.content.endsWith(' ') ? ' ' : '') + processedText + ' ';
              return { ...tab, content: newContent };
            }
            return tab;
          }));
        }
        
        lastSpeechDetected.current = Date.now();
        setShowNoSpeechDetected(false);
      };

      recognition.onerror = (event) => {
        setError('Error occurred in recognition: ' + event.error);
        setIsListening(false);
      };

      setRecognition(recognition);
    } else {
      setError('Speech recognition is not supported in this browser.');
    }
  }, [tabs]); // Add tabs as dependency to ensure we always have the latest tabs state

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      if (noSpeechTimeout.current) {
        clearInterval(noSpeechTimeout.current);
      }
    } else {
      recognition.start();
      lastSpeechDetected.current = Date.now();
    }
    setIsListening(!isListening);
    setShowNoSpeechDetected(false);
  }, [isListening, recognition]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(activeTab.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy text to clipboard');
    }
  };

  const updateActiveTabContent = (newContent: string | ((prev: string) => string)) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === activeTabId 
          ? { 
              ...tab, 
              content: typeof newContent === 'function' 
                ? newContent(tab.content) 
                : newContent 
            }
          : tab
      )
    );
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateActiveTabContent(e.target.value);
  };

  const addNewTab = () => {
    const newTabId = String(Date.now());
    const newTabNumber = tabs.length + 1;
    const newTab = { 
      id: newTabId, 
      title: `Untitled ${newTabNumber}`,
      content: '' 
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    setIsEditingTitle(newTabId);
    setEditingTitleValue(`Untitled ${newTabNumber}`);
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      return;
    }
    
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    if (activeTabId === tabId) {
      const tabIndex = tabs.findIndex(tab => tab.id === tabId);
      const nextTabId = tabs[tabIndex - 1]?.id || tabs[tabIndex + 1]?.id;
      setActiveTabId(nextTabId);
    }
  };

  const startEditingTitle = (tabId: string, currentTitle: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsEditingTitle(tabId);
    setEditingTitleValue(currentTitle);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitleValue(e.target.value);
  };

  const finishEditingTitle = () => {
    if (isEditingTitle) {
      setTabs(prev => 
        prev.map(tab => 
          tab.id === isEditingTitle
            ? { ...tab, title: editingTitleValue.trim() || 'Untitled' }
            : tab
        )
      );
    }
    setIsEditingTitle(null);
    setEditingTitleValue('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      finishEditingTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(null);
      setEditingTitleValue('');
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    if (tabId === activeTabId) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        startEditingTitle(tabId, tab.title);
      }
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg 
          transition-all duration-300 ease-in-out flex items-center gap-3 px-4 py-3
          ${showNoSpeechDetected 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 -translate-y-full pointer-events-none'
          }`}
      >
        <Volume2 className="w-5 h-5 text-yellow-500" />
        <span className="text-gray-700">No speech detected. Please speak louder or check your microphone.</span>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
            Voice to Text
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Click the microphone to start recording your voice. Your text will be saved automatically in tabs.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={toggleListening}
              className={`p-4 rounded-full transition-all ${
                isListening
                  ? 'bg-red-100 hover:bg-red-200 text-red-600'
                  : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
              }`}
              disabled={!recognition}
            >
              {isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          <div className="mb-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="flex-1 flex items-center overflow-x-auto">
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`group relative flex items-center min-w-[120px] px-4 py-2 cursor-pointer border-b-2 mr-1 ${
                      activeTabId === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    onClick={() => handleTabClick(tab.id)}
                  >
                    {isEditingTitle === tab.id ? (
                      <input
                        type="text"
                        value={editingTitleValue}
                        onChange={handleTitleChange}
                        onBlur={finishEditingTitle}
                        onKeyDown={handleTitleKeyDown}
                        className="w-full bg-transparent border border-blue-300 rounded px-1 focus:outline-none focus:border-blue-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="flex-1 truncate mr-2">
                          {tab.title}
                        </span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => startEditingTitle(tab.id, tab.title, e)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="w-3 h-3 text-gray-500 hover:text-gray-700" />
                          </button>
                          {tabs.length > 1 && (
                            <button
                              onClick={(e) => closeTab(tab.id, e)}
                              className="p-1 hover:bg-gray-100 rounded ml-1"
                            >
                              <X className="w-3 h-3 text-gray-500 hover:text-gray-700" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addNewTab}
                className="p-2 text-gray-500 hover:text-gray-700"
                title="New tab"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={activeTab.content}
              onChange={handleTextChange}
              placeholder="Start typing or recording..."
              className="w-full min-h-[200px] max-h-[400px] p-4 bg-gray-50 rounded-lg mb-4 resize-y font-sans text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ 
                lineHeight: '1.5',
                overflowY: 'auto'
              }}
            />

            {isListening && (
              <div className="absolute bottom-8 left-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            )}

            <button
              onClick={copyToClipboard}
              className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 rounded"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="text-center text-sm text-gray-500">
            {isListening ? 'Listening...' : 'Click the microphone to start'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;