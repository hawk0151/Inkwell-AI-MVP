import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Image, Save } from 'lucide-react'; 
import { useAuth } from '../contexts/AuthContext'; 

const TimelineEventEditor = ({ initialEvents = [], onSave, apiClient }) => {
    const [events, setEvents] = useState(initialEvents.length > 0 ? initialEvents : [{ id: Date.now(), text: '', imageUrl: null, tempPreviewUrl: null, fileToUpload: null }]);
    const [uploadingImageId, setUploadingImageId] = useState(null); 
    const { token } = useAuth(); 

    const addEvent = () => {
        setEvents(prevEvents => [...prevEvents, { id: Date.now(), text: '', imageUrl: null, tempPreviewUrl: null, fileToUpload: null }]);
    };

    const updateEventText = (id, newText) => {
        setEvents(prevEvents =>
            prevEvents.map(event => (event.id === id ? { ...event, text: newText } : event))
        );
    };

    const handleFileChange = (id, e) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setEvents(prevEvents =>
                prevEvents.map(event => (event.id === id ? { ...event, tempPreviewUrl: previewUrl, fileToUpload: file } : event))
            );
        }
    };

    const uploadImageForEvent = async (id) => {
        if (!token) { 
            alert("Please log in to upload images. Redirecting to login...");
            // You might want to navigate to the login page here if 'navigate' prop is available
            return;
        }

        const eventToUpload = events.find(event => event.id === id);
        if (!eventToUpload || !eventToUpload.fileToUpload) {
            alert("No file selected for upload.");
            return;
        }

        setUploadingImageId(id);
        try {
            const imageData = await apiClient.uploadImage(eventToUpload.fileToUpload, token); 
            
            setEvents(prevEvents =>
                prevEvents.map(event =>
                    event.id === id ? { ...event, imageUrl: imageData.imageUrl, tempPreviewUrl: null, fileToUpload: null } : event
                )
            );
            alert("Image uploaded successfully!");
        } catch (error) {
            console.error("Error uploading image:", error);
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                alert("Authentication failed. Please log in again.");
            } else {
                alert("Image upload failed: " + (error.message || "Unknown error"));
            }
            setEvents(prevEvents =>
                prevEvents.map(event =>
                    event.id === id ? { ...event, tempPreviewUrl: null, fileToUpload: null } : event
                )
            );
        } finally {
            setUploadingImageId(null);
        }
    };

    const deleteEvent = (id) => {
        setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
    };

    const moveEventUp = (id) => {
        const index = events.findIndex(event => event.id === id);
        if (index > 0) {
            const newEvents = [...events];
            [newEvents[index - 1], newEvents[index]] = [newEvents[index], newEvents[index - 1]];
            setEvents(newEvents);
        }
    };

    const moveEventDown = (id) => {
        const index = events.findIndex(event => event.id === id);
        if (index < events.length - 1) {
            const newEvents = [...events];
            [newEvents[index + 1], newEvents[index]] = [newEvents[index], newEvents[index + 1]];
            setEvents(newEvents);
        }
    };

    const handleSave = () => {
        if (onSave) {
            onSave(events);
        }
    };

    return (
        <div className="bg-white/60 backdrop-blur-md p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200/50 space-y-8">
            <h2 className="text-3xl font-serif font-semibold text-slate-800 text-center mb-6">Build Your Picture Book Timeline</h2>

            <div className="space-y-6">
                {events.map((event, index) => (
                    <div key={event.id} className="relative bg-slate-50 p-6 rounded-lg shadow-inner border border-slate-200 fade-in">
                        <div className="absolute top-2 right-2 flex space-x-1">
                            {index > 0 && (
                                <button
                                    onClick={() => moveEventUp(event.id)}
                                    className="p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors"
                                    title="Move Up"
                                >
                                    <ArrowUp size={16} />
                                </button>
                            )}
                            {index < events.length - 1 && (
                                <button
                                    onClick={() => moveEventDown(event.id)}
                                    className="p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors"
                                    title="Move Down"
                                >
                                    <ArrowDown size={16} />
                                </button>
                            )}
                            <button
                                onClick={() => deleteEvent(event.id)}
                                className="p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                                title="Delete Event"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <h3 className="font-semibold text-xl text-slate-800 mb-3">Event {index + 1}</h3>
                        <textarea
                            value={event.text}
                            onChange={(e) => updateEventText(event.id, e.target.value)}
                            placeholder="Describe this scene or moment in the story..."
                            className="w-full p-3 text-base bg-white/80 border-2 border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-500 transition h-24"
                        />
                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
                            {event.imageUrl || event.tempPreviewUrl ? (
                                <div className="relative w-32 h-32 rounded-lg border border-slate-300 overflow-hidden">
                                    <img src={event.imageUrl || event.tempPreviewUrl} alt={`Event ${index + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => {
                                            setEvents(prevEvents => prevEvents.map(e => e.id === event.id ? { ...e, imageUrl: null, tempPreviewUrl: null, fileToUpload: null } : e));
                                        }}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity"
                                        title="Remove Image"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2"> 
                                    <label htmlFor={`file-upload-${event.id}`} className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors border border-amber-300 cursor-pointer">
                                        <Image size={20} /> Select Image
                                    </label>
                                    <input
                                        id={`file-upload-${event.id}`}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(event.id, e)}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => alert('AI Image Generation coming soon!')}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors border border-blue-300"
                                    >
                                        <Image size={20} /> Generate with AI
                                    </button>
                                </div>
                            )}

                            {event.fileToUpload && !event.imageUrl && (
                                <button
                                    onClick={() => uploadImageForEvent(event.id)}
                                    disabled={uploadingImageId === event.id}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg shadow-sm hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    {uploadingImageId === event.id ? 'Uploading...' : 'Upload Image'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200">
                <button
                    onClick={addEvent}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl shadow-md hover:bg-slate-700 transition-colors"
                >
                    <Plus size={20} /> Add New Event
                </button>
                <button
                    onClick={handleSave}
                    disabled={uploadingImageId !== null}
                    className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl shadow-md hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed transition-colors"
                >
                    <Save size={20} /> Save Picture Book
                </button>
            </div>
        </div>
    );
};

export default TimelineEventEditor;