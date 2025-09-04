import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/autoplay';

const StarRating = ({ rating = 5 }) => (
    <div className="flex">
        {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} className={`w-5 h-5 ${i < rating ? 'text-amber-400' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.96a1 1 0 00.95.69h4.167c.969 0 1.371 1.24.588 1.81l-3.37 2.45c-.3.22-.48.614-.188.948l1.286 3.96c.3.921-.755 1.688-1.539 1.118l-3.37-2.45a1 1 0 00-1.176 0l-3.37 2.45c-.784.57-1.838-.197-1.539-1.118l1.286-3.96c.292-.904-.08-1.728-.69-2.09l-3.37-2.45c-.783-.57-.38-1.81.588-1.81h4.167c.358 0 .685-.224.815-.558l1.286-3.96z" />
            </svg>
        ))}
    </div>
);

const ReviewCard = ({ quote, author, location, rating }) => {
    // --- FIX: Replaced DiceBear with a professional photo avatar service ---

    // 1. Create a simple, consistent "hash" from the author's name.
    // This ensures that the same author always gets the same image number.
    const nameHash = author.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // 2. Use the hash to pick a gender and a specific photo number.
    // There are 78 male and 78 female photos available (0-77).
    const gender = nameHash % 2 === 0 ? 'male' : 'female';
    const avatarNumber = nameHash % 78;

    // 3. Construct the new URL.
    const avatarUrl = `https://xsgames.co/randomusers/assets/avatars/${gender}/${avatarNumber}.jpg`;
    
    // --- END FIX ---

    return (
        <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-slate-700 h-full flex flex-col w-[350px] sm:w-[420px]">
            <div className="mb-4">
                <StarRating rating={rating} />
            </div>
            <p className="text-slate-300 italic text-lg leading-relaxed flex-grow">"{quote}"</p>
            <div className="flex items-center mt-6">
                <img src={avatarUrl} alt={author} className="w-12 h-12 rounded-full mr-4 bg-slate-700 border-2 border-amber-400" />
                <div>
                    <span className="font-semibold text-amber-300 text-lg block">{author}</span>
                    <span className="text-slate-400 text-sm block">{location}</span>
                </div>
            </div>
        </div>
    );
};

const Testimonials = () => {
    const reviews = [
        { quote: "I typed in a silly inside joke from our childhood, and the AI wove it into the story so perfectly. My sister cried when she read it. The most incredible gift I've ever given.", author: "Tyler H.", location: "London, UK", rating: 5 },
        { quote: "My son has a hard time reading, but he hasn't put this book down. Seeing himself as the hero of his own adventure is pure magic. The quality of the printed hardcover is fantastic too.", author: "David L.", location: "Sydney, AU", rating: 5 },
        { quote: "As a writer, I was skeptical, but I'm blown away. The story coherence is amazing chapter after chapter. It feels like a genuine collaboration. I've already started my second book!", author: "Maria G.", location: "Toronto, CA", rating: 5 },
        { quote: "The perfect bedtime story. We created a character that looks just like our daughter and has her love for space. She asks to read 'her book' every single night.", author: "Chloe T.", location: "Auckland, NZ", rating: 5 },
        { quote: "An absolute 10/10 experience. The process was simple, the AI was creative, and the final printed book is a treasure we'll keep forever. Highly recommended.", author: "Ben Carter", location: "Austin, TX", rating: 5 },
    ];

    return (
        <div className="py-24 overflow-hidden">
            <h2 className="text-4xl md:text-5xl font-serif font-extrabold mb-16 text-center text-teal-400">
                Loved by Storytellers Everywhere
            </h2>
            <Swiper
                modules={[Autoplay]}
                className="!w-full"
                spaceBetween={30}
                slidesPerView="auto"
                loop={true}
                autoplay={{
                    delay: 1,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                }}
                speed={10000}
                grabCursor={true}
                centeredSlides={false}
                breakpoints={{
                    320: { slidesPerView: 1, spaceBetween: 20, centeredSlides: true },
                    768: { slidesPerView: 2, spaceBetween: 30 },
                    1024: { slidesPerView: "auto" },
                }}
            >
                {[...reviews, ...reviews].map((review, index) => (
                    <SwiperSlide key={index} className="!w-auto !flex !items-stretch">
                        <ReviewCard {...review} />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default Testimonials;