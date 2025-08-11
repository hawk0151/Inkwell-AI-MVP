import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import toast from 'react-hot-toast';
import { LoadingSpinner } from './common.jsx';

const MAX_CHARACTERS = 200;

const BackCoverBlurbEditor = ({ bookId, initialBlurb }) => {
    const [blurb, setBlurb] = useState(initialBlurb);
    const queryClient = useQueryClient();

    const blurbMutation = useMutation({
        mutationFn: (newBlurb) => apiClient.post(`/text-books/${bookId}/blurb`, { blurb: newBlurb }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['bookDetails', bookId] });
            toast.success('Back cover blurb saved!');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to save blurb.');
        },
    });

    const handleSaveBlurb = () => {
        if (blurb.length > MAX_CHARACTERS) {
            toast.error(`Blurb cannot exceed ${MAX_CHARACTERS} characters.`);
            return;
        }
        blurbMutation.mutate(blurb);
    };

    const handleChange = (e) => {
        setBlurb(e.target.value);
    };

    return (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <div className="w-full">
                <textarea
                    value={blurb}
                    onChange={handleChange}
                    maxLength={MAX_CHARACTERS}
                    rows="6"
                    placeholder="Enter your back cover blurb here (max 200 characters)..."
                    className="w-full p-4 bg-slate-700/50 text-slate-100 rounded-md border border-slate-600 focus:ring focus:ring-amber-500 focus:border-amber-500 resize-none"
                    disabled={blurbMutation.isPending}
                />
                <p className="text-right text-sm text-slate-400 mt-1">
                    {blurb.length} / {MAX_CHARACTERS}
                </p>
            </div>
            <button 
                onClick={handleSaveBlurb}
                disabled={blurbMutation.isPending}
                className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-all duration-300 w-full"
            >
                {blurbMutation.isPending ? <LoadingSpinner text="Saving..." /> : 'Save Blurb'}
            </button>
        </div>
    );
};

export default BackCoverBlurbEditor;