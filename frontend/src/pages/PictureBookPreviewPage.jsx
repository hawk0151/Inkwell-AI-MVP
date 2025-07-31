import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common';

const fetchBookData = async (bookId) => {
    if (!bookId) return null;
    const { data } = await apiClient.get(`/picture-books/${bookId}`);
    return data;
};

function PictureBookPreviewPage() {
    const { bookId } = useParams();
    const navigate = useNavigate();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['pictureBookPreview', bookId],
        queryFn: () => fetchBookData(bookId),
        enabled: !!bookId,
    });

    if (isLoading) return <LoadingSpinner text="Loading preview..." />;
    if (isError) return <Alert title="Error">Failed to load project preview.</Alert>;

    const book = data?.book;
    const timeline = data?.timeline || [];

    return (
        <div className="fade-in max-w-4xl mx-auto py-8 px-4">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-serif text-white">{book?.title}</h1>
                <p className="text-lg text-slate-400">A Story Preview</p>
            </div>

            <div className="space-y-16">
                {/* Cover Page */}
                <div className="bg-slate-800/50 p-8 rounded-lg shadow-lg text-center h-96 flex flex-col justify-center items-center">
                    <h2 className="text-5xl font-serif text-white">{book?.title}</h2>
                    <p className="mt-4 text-xl text-gray-300">by Inkwell AI</p>
                </div>

                {/* Timeline Pages */}
                {timeline.map((event, index) => (
                    <div key={index} className="bg-slate-800/50 p-8 rounded-lg shadow-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className={index % 2 === 0 ? 'md:order-1' : 'md:order-2'}>
                                {event.image_url ? (
                                    <img
                                        src={event.image_url}
                                        alt={event.event_date || 'Timeline image'}
                                        className="rounded-md object-cover w-full h-80"
                                    />
                                ) : (
                                    <div className="bg-slate-700 rounded-md w-full h-80 flex items-center justify-center">
                                        <p className="text-slate-400">No Image</p>
                                    </div>
                                )}
                            </div>
                            <div className={index % 2 === 0 ? 'md:order-2' : 'md:order-1'}>
                                <h3 className="text-2xl font-bold font-serif text-white mb-3">{event.event_date}</h3>
                                <p className="text-slate-300 leading-relaxed">{event.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="text-center mt-12">
                <button 
                    onClick={() => navigate(`/project/${bookId}`)} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition"
                >
                    Back to Editor
                </button>
            </div>
        </div>
    );
}

export default PictureBookPreviewPage;
