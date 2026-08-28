
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, DumbbellIcon, BuildingIcon, ClockIcon, UsersIcon, ChevronDownIcon, DocumentTextIcon, PencilIcon, SpeakerphoneIcon, ChartBarIcon, TrophyIcon, QrCodeIcon, LightningIcon } from './icons';
import { GalleryImage, Partner } from '../types';
import { getGalleryImages, getPartners, createLead } from '../services/firebaseService';

interface LandingPageProps {
    onLoginClick: () => void;
    onRegisterGymClick?: () => void;
}

const FeatureCard: React.FC<{ title: string; desc: string; icon: React.ReactNode; delay: number }> = ({ title, desc, icon, delay }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay, duration: 0.5 }}
        className="bg-white border border-gray-200 shadow-sm p-8 rounded-3xl hover:border-primary/50 transition-colors group"
    >
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-primary/10">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-600 leading-relaxed">
            {desc}
        </p>
    </motion.div>
);

const SystemImages = () => (
    <div className="relative h-[350px] md:h-[450px] w-full max-w-lg mx-auto flex items-center justify-center">
        {/* Startsidan (Back Left) */}
        <motion.div 
            animate={{ y: [0, -10, 0] }} 
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 top-4 w-48 md:w-56 rounded-2xl border border-gray-200 shadow-xl overflow-hidden opacity-90 transform -rotate-6 origin-bottom-right bg-gray-900"
        >
            <img src="/startskarm.png" alt="Startskärm" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
        </motion.div>

        {/* Fristående Timer (Back Right) */}
        <motion.div 
            animate={{ y: [0, 10, 0] }} 
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute right-0 bottom-4 w-48 md:w-56 rounded-2xl border border-gray-200 shadow-xl overflow-hidden opacity-90 transform rotate-6 origin-bottom-left bg-gray-900"
        >
            <img src="/timer.png" alt="Fristående Timer" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
        </motion.div>

        {/* Timer i pass (Center Front, moved left) */}
        <motion.div 
            animate={{ y: [0, -8, 0] }} 
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute z-10 left-[30%] transform -translate-x-1/2 top-1/2 -translate-y-1/2 w-56 md:w-64 rounded-2xl border border-gray-300 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden bg-white"
        >
            <img src="/pass.png" alt="Timer i pass" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
        </motion.div>
    </div>
);

/**
 * Bildplats som visar en riktig bild när filen finns i public/landing/, och en
 * diskret platshållare tills dess. Släpp filen med rätt namn i mappen — ingen
 * kodändring behövs, bilden dyker upp automatiskt.
 */
const ImageSlot: React.FC<{ src: string; alt: string; label: string; className?: string }> = ({ src, alt, label, className = '' }) => {
    // Bilden får ligga som .jpg, .png eller .webp — vi provar i tur och ordning.
    const candidates = [src, src.replace(/\.jpg$/, '.png'), src.replace(/\.jpg$/, '.webp')];
    const [attempt, setAttempt] = useState(0);
    if (attempt >= candidates.length) {
        return (
            <div className={`flex flex-col items-center justify-center bg-gray-100 border border-dashed border-gray-300 rounded-2xl text-center p-6 ${className}`}>
                <span className="text-3xl mb-2">📷</span>
                <span className="text-sm text-gray-500 font-medium">{label}</span>
            </div>
        );
    }
    return <img key={candidates[attempt]} src={candidates[attempt]} alt={alt} onError={() => setAttempt(a => a + 1)} className={`object-cover rounded-2xl border border-gray-200 ${className}`} loading="lazy" decoding="async" />;
};

/**
 * Hjältens media: provar i tur och ordning video (landing/hero.mp4), stillbild
 * (landing/hero.jpg) och faller sist tillbaka på produktmockupen. Så fort en
 * riktig film eller bild läggs i public/landing/ tar den över.
 */
const HERO_IMAGES = ['/landing/hero.jpg', '/landing/hero.png', '/landing/hero.webp'];

const HeroMedia: React.FC = () => {
    const [stage, setStage] = useState<'video' | 'image' | 'mockup'>('video');
    const [imageAttempt, setImageAttempt] = useState(0);
    if (stage === 'mockup') return <SystemImages />;
    if (stage === 'image') {
        if (imageAttempt >= HERO_IMAGES.length) return <SystemImages />;
        return (
            <img
                key={HERO_IMAGES[imageAttempt]}
                src={HERO_IMAGES[imageAttempt]}
                alt="SmartStudio på skärmen i en studio"
                onError={() => setImageAttempt(a => a + 1)}
                className="w-full max-h-[520px] object-cover object-center rounded-3xl border border-gray-200 shadow-xl"
            />
        );
    }
    return (
        <video
            src="/landing/hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            onError={() => setStage('image')}
            className="w-full h-auto rounded-3xl border border-gray-200 shadow-xl"
        />
    );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterGymClick }) => {
    const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
    const [leadForm, setLeadForm] = useState({ name: '', email: '', gymName: '', phone: '', message: '' });
    const [isSubmittingLead, setIsSubmittingLead] = useState(false);
    const [leadSuccess, setLeadSuccess] = useState(false);

    useEffect(() => {
        const loadGalleryAndPartners = async () => {
            const [images, partnersData] = await Promise.all([
                getGalleryImages(),
                getPartners()
            ]);
            setGalleryImages(images);
            setPartners(partnersData);
        };
        loadGalleryAndPartners();
    }, []);

    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadForm.name || !leadForm.email || !leadForm.gymName || !leadForm.phone) return;
        
        setIsSubmittingLead(true);
        const success = await createLead(leadForm);
        setIsSubmittingLead(false);
        
        if (success) {
            setLeadSuccess(true);
            setTimeout(() => {
                setIsDemoModalOpen(false);
                setLeadSuccess(false);
                setLeadForm({ name: '', email: '', gymName: '', phone: '', message: '' });
            }, 3000);
        } else {
            alert("Ett fel uppstod. Vänligen försök igen senare.");
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-primary selection:text-white overflow-x-hidden">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/favicon.png" alt="SmartStudio Logo" className="w-8 h-8 rounded-lg" referrerPolicy="no-referrer" />
                        <span className="text-xl font-bold tracking-tight">SmartStudio</span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setIsDemoModalOpen(true)} className="text-sm font-semibold text-primary hover:brightness-90 transition-colors hidden sm:block">
                            Boka Demo
                        </button>
                        <button onClick={onLoginClick} className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
                            Logga in
                        </button>
                        <button onClick={onRegisterGymClick || onLoginClick} className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-gray-800 transition-colors">
                            Kom igång
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }}></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/15 rounded-full blur-[120px] pointer-events-none"></div>
                
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
                    <div className="text-center lg:text-left">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <span className="inline-block py-1 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
                                SÅ ENKELT ATT ALLA KAN ANVÄNDA DET
                            </span>
                            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-none mb-6">
                                Skriv, klistra in en anteckning eller ladda upp en bild. <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">
                                    Låt AI göra resten.
                                </span>
                            </h1>
                            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                                Byggt i en riktig studio, av oss som står i den varje dag. Rita upp passet för hand på whiteboarden precis som du alltid gjort — vi tolkar texten, sätter upp timern och visar passet snyggt för dina medlemmar.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <button onClick={onRegisterGymClick || onLoginClick} className="bg-primary hover:brightness-95 text-white text-lg px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)]">
                                    Byt ut din whiteboard idag
                                </button>
                                <button 
                                    onClick={() => setIsDemoModalOpen(true)}
                                    className="px-8 py-4 rounded-full font-bold border border-gray-300 text-gray-900 hover:bg-gray-50 transition-colors"
                                >
                                    Boka Demo
                                </button>
                            </div>
                        </motion.div>
                    </div>
                    
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative"
                    >
                        <HeroMedia />
                    </motion.div>
                </div>
            </section>

            {/* Så funkar det — tre steg med riktiga bilder */}
            <section className="py-24 bg-white relative border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Från whiteboard till loggat pass. Tre steg.</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Så här ser det ut på riktigt — inga menyer, ingen administration.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { nr: '1', title: 'Skissa passet', desc: 'Skriv passet för hand på whiteboarden eller i en anteckning — precis som du alltid gjort.', src: '/landing/steg1-whiteboard.jpg', label: 'Bild kommer: whiteboardskissen' },
                            { nr: '2', title: 'AI:n bygger det', desc: 'Passet tolkas automatiskt: övningar, block och timer — klart på skärmen i lokalen.', src: '/landing/steg2-skarm.jpg', label: 'Bild kommer: passet på skärmen' },
                            { nr: '3', title: 'Skärmen kör passet', desc: 'Timern rullar och passet syns från hela rummet. Ingen behöver fråga vad som gäller eller hur lång tid det är kvar.', src: '/landing/steg3-followme.jpg', label: 'Bild kommer: passet igång på skärmen' },
                        ].map((step, i) => (
                            <motion.div
                                key={step.nr}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.15, duration: 0.5 }}
                                className="text-center"
                            >
                                <ImageSlot src={step.src} alt={step.title} label={step.label} className="w-full h-80 md:h-96 mb-6" />
                                <div className="w-10 h-10 rounded-full bg-primary text-black font-black text-lg flex items-center justify-center mx-auto mb-4">{step.nr}</div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-gray-50 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Allt passet behöver på skärmen.</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Byggt för boxägare, personliga tränare och gymkedjor. Ett pass tar minuter att bygga och syns direkt på skärmen i lokalen — ni sparar timmar varje vecka, höjer kvaliteten på passen och lyfter hela verksamheten till nästa nivå.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FeatureCard 
                            title="Färdiga pass på sekunder" 
                            desc="Beskriv passet med några ord, så byggs det klart: block, övningar, vikter och vila."
                            icon={<SparklesIcon className="w-8 h-8" />}
                            delay={0.1}
                        />
                        <FeatureCard 
                            title="Timers hela lokalen ser" 
                            desc="Tabata, EMOM, AMRAP eller HYROX. Stora, tydliga och synkade på alla skärmar — och de hörs."
                            icon={<ClockIcon className="w-8 h-8" />}
                            delay={0.2}
                        />
                        <FeatureCard 
                            title="Skärmen jobbar mellan passen" 
                            desc="Erbjudanden, scheman och nyheter rullar när ingen tränar. Schemalägg en gång, sen sköter det sig."
                            icon={<SpeakerphoneIcon className="w-8 h-8" />}
                            delay={0.3}
                        />
                        <FeatureCard 
                            title="Planera hemma i soffan" 
                            desc="Anteckningen ligger redo på skärmen när du kliver in i lokalen — och blir ett färdigt pass med ett tryck."
                            icon={<DocumentTextIcon className="w-8 h-8" />}
                            delay={0.4}
                        />
                        <FeatureCard 
                            title="Whiteboarden — fast smartare" 
                            desc="Skissa passet för hand precis som på tavlan. Men den här hörs, syns från hela rummet och suddas aldrig ut."
                            icon={<PencilIcon className="w-8 h-8" />}
                            delay={0.5}
                        />
                        <FeatureCard 
                            title="Idétorka? Låt AI:n ta fram pass" 
                            desc="Skriv vad ni önskar, så får ni ett passförslag. Ett bollplank när inspirationen tryter — ni bestämmer fortfarande."
                            icon={<LightningIcon className="w-8 h-8" />}
                            delay={0.6}
                        />
                    </div>
                </div>
            </section>

            {/* Pris — allt som ingår */}
            <section className="py-24 bg-white relative border-t border-gray-100">
                <div className="max-w-4xl mx-auto px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="bg-gradient-to-b from-white to-gray-50 border border-primary/30 shadow-lg rounded-3xl p-10 md:p-14 text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
                        <p className="text-sm font-bold text-primary mb-4 uppercase tracking-wider relative z-10">
                            Skolan har redan gjort resan. Nu är det gymmens tur.
                        </p>
                        <span className="inline-block py-1.5 px-4 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest mb-4 relative z-10">
                            Introduktionspris
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold mb-2 relative z-10">Ett pris per skärm. Inga överraskningar.</h2>
                        <div className="my-6 relative z-10">
                            <p className="text-5xl md:text-6xl font-black text-gray-900">
                                995 kr<span className="text-xl font-bold text-gray-400">/mån per skärm</span>
                            </p>
                            <p className="text-sm font-bold text-gray-400 mt-2">
                                Ordinarie pris <span className="line-through">1 995 kr/mån</span> — introduktionspriset gäller er som kommer med nu.
                            </p>
                        </div>
                        <ul className="text-left max-w-md mx-auto space-y-3 mb-10 relative z-10">
                            {[
                                'Skärmappen: timer, whiteboard och AI-passbyggare',
                                'Info-karusellen: skärmen jobbar även mellan passen',
                                'Ingen installation — allt körs i webbläsaren',
                            ].map(item => (
                                <li key={item} className="flex items-start gap-3 text-gray-700">
                                    <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-sm text-gray-500 mb-2 relative z-10">
                            Ni behöver en touchskärm i lokalen. Går att köpa via oss.
                        </p>
                        <p className="text-sm text-gray-500 mb-8 relative z-10">
                            Medlemsappen är ett <strong className="text-gray-700">tillval</strong> — läs mer om den nedan.
                        </p>
                        <button
                            onClick={() => setIsDemoModalOpen(true)}
                            className="bg-orange-500 hover:brightness-95 text-white text-lg px-10 py-4 rounded-full font-bold transition-all transform hover:scale-105 relative z-10 shadow-lg shadow-orange-500/20"
                        >
                            Boka en kostnadsfri demo
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Medlemsappen */}
            <section className="py-24 bg-gradient-to-b from-white to-gray-50 relative border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="inline-block py-1 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
Tillval · Medlemsappen
                        </span>
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Skärmen visar passet. Appen får dem att komma tillbaka.</h2>
                        <p className="text-gray-600 max-w-3xl mx-auto text-lg leading-relaxed">
                            Medlemmen skannar en QR-kod på skärmen och loggar sitt pass direkt. Systemet räknar ut personbästa, sätter målvikter till nästa gång och visar utvecklingen svart på vitt. Det är skillnaden mellan att träna och att veta att man blir starkare. Skärmen fungerar utmärkt på egen hand — appen är ett tillval för er som vill ge medlemmarna mer.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <FeatureCard
                            title="Logga med ett svep"
                            desc="Skanna QR-koden på skärmen så ligger passets övningar redan i appen. Inga listor att leta i, inget att skriva in två gånger."
                            icon={<QrCodeIcon className="w-8 h-8" />}
                            delay={0.1}
                        />
                        <FeatureCard
                            title="Mätbar styrka och kondition"
                            desc="Personbästa räknas fram automatiskt, och resultaten jämförs mot Strength Levels standarder och Concept2:s roddtabeller — anpassat efter ålder, kön och kroppsvikt."
                            icon={<ChartBarIcon className="w-8 h-8" />}
                            delay={0.2}
                        />
                        <FeatureCard
                            title="Milstolpar och Min månad"
                            desc="Diplom efter varje pass, milstolpar när de passeras och en månadssammanfattning som medlemmarna faktiskt vill dela."
                            icon={<TrophyIcon className="w-8 h-8" />}
                            delay={0.3}
                        />
                    </div>

                    {/* Riktiga skärmbilder ur appen */}
                    <div className="mt-12 flex flex-wrap justify-center gap-6">
                        <ImageSlot src="/landing/app-styrka.jpg" alt="Min styrka i medlemsappen" label="Bild kommer: Min styrka i appen" className="w-56 h-96" />
                        <ImageSlot src="/landing/app-diplom.jpg" alt="Diplom i medlemsappen" label="Bild kommer: diplom i appen" className="w-56 h-96" />
                    </div>
                </div>
            </section>

            {/* Customer Gallery Marquee */}
            {galleryImages.length > 0 && (
                <section className="py-24 bg-gray-50 relative overflow-hidden border-t border-gray-100">
                    <div className="text-center mb-12 px-6">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Gör som dessa studios – ta träningen till nästa nivå</h2>
                        <blockquote className="max-w-3xl mx-auto mt-8">
                            <p className="text-xl md:text-2xl text-gray-700 leading-relaxed italic">
                                ”Vi sparar massor med tid och har samtidigt höjt kvaliteten på flera områden.”
                            </p>
                            <footer className="mt-4 text-sm text-gray-500">
                                <span className="font-bold text-gray-900">Maria Andersson</span>, coach på Flexibel Hälsostudio Hisings Kärra
                            </footer>
                        </blockquote>
                    </div>
                    
                    <div className="relative w-full flex overflow-hidden group">
                        {/* Duplicate the array to create an infinite loop effect */}
                        <motion.div 
                            className="flex gap-6 px-3"
                            animate={{ x: ["0%", "-50%"] }}
                            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
                        >
                            {[...galleryImages, ...galleryImages].map((img, idx) => (
                                <div key={`${img.id}-${idx}`} className="relative flex-shrink-0 w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden border border-gray-200 group-hover:opacity-75 hover:!opacity-100 transition-opacity">
                                    <img
                                        src={img.imageUrl}
                                        alt={img.gymName || 'Studio'}
                                        className="w-full h-full object-cover"
                                        width={320}
                                        height={320}
                                        decoding="async"
                                        loading={idx >= galleryImages.length ? 'lazy' : 'eager'}
                                    />
                                    {img.gymName && (
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-12">
                                            <span className="text-white font-bold text-lg">{img.gymName}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </section>
            )}

            {/* Partners Grid */}
            {partners.length > 0 && (
                <section className="py-20 bg-white relative overflow-hidden border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-gray-900">Våra Partners</h2>
                            <p className="text-gray-600 text-sm max-w-xl mx-auto">
                                Vi samarbetar med ledande varumärken inom träning och hälsa för att erbjuda bästa möjliga upplevelse.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-center">
                            {partners.map((partner) => {
                                const CardContent = (
                                    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-primary/40 transition-colors h-32 group">
                                        <div className="w-full h-16 flex items-center justify-center">
                                            <img 
                                                src={partner.logoUrl} 
                                                alt={partner.name} 
                                                className="max-w-[140px] max-h-full object-contain transition-all duration-300"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500 group-hover:text-gray-700 font-medium mt-2 transition-colors">{partner.name}</span>
                                    </div>
                                );

                                if (partner.websiteUrl) {
                                    return (
                                        <a 
                                            key={partner.id}
                                            href={partner.websiteUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block cursor-pointer transition-transform duration-200 hover:-translate-y-1 w-full"
                                        >
                                            {CardContent}
                                        </a>
                                    );
                                }

                                return (
                                    <div key={partner.id} className="w-full">
                                        {CardContent}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* Bottom CTA Section */}
            <section className="py-24 bg-gradient-to-b from-gray-50 to-white border-t border-gray-100 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
                
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 tracking-tight">Redo att ta din studio till nästa nivå?</h2>
                        <p className="text-lg text-gray-600 mb-2">
                            <span className="font-black text-gray-900">995 kr/mån</span> per skärm i introduktionspris — ordinarie 1 995 kr/mån.
                        </p>
                        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                            Boka en kostnadsfri demo så visar vi hur SmartStudio kan spara tid och lyfta upplevelsen för dina medlemmar.
                        </p>
                        <button 
                            onClick={() => setIsDemoModalOpen(true)}
                            className="bg-orange-500 hover:brightness-95 text-white text-lg px-10 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-lg shadow-orange-500/20"
                        >
                            Boka Demo
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-200 py-12 bg-white">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <img src="/favicon.png" alt="SmartStudio Logo" className="w-6 h-6 rounded-md" referrerPolicy="no-referrer" />
                        <span className="font-bold text-lg">SmartStudio</span>
                    </div>
                    <div className="text-gray-500 text-sm">
                        © 2026 SmartStudio AB. Alla rättigheter förbehållna.
                    </div>
                </div>
            </footer>

            {/* Demo Modal */}
            {isDemoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full relative shadow-2xl"
                    >
                        <button 
                            onClick={() => setIsDemoModalOpen(false)}
                            className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {leadSuccess ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tack för din förfrågan!</h3>
                                <p className="text-gray-600">Vi hör av oss till dig så snart som möjligt för att boka in en demo.</p>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Boka en Demo</h3>
                                <p className="text-gray-600 mb-6">Fyll i dina uppgifter så kontaktar vi dig för att visa hur SmartStudio kan hjälpa din verksamhet.</p>
                                
                                <form onSubmit={handleLeadSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ditt namn *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={leadForm.name}
                                            onChange={e => setLeadForm({...leadForm, name: e.target.value})}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="Anna Andersson"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">E-postadress *</label>
                                        <input 
                                            type="email" 
                                            required
                                            value={leadForm.email}
                                            onChange={e => setLeadForm({...leadForm, email: e.target.value})}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="anna@exempel.se"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gymmets/Studions namn *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={leadForm.gymName}
                                            onChange={e => setLeadForm({...leadForm, gymName: e.target.value})}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="CrossFit Svea"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefonnummer *</label>
                                        <input 
                                            type="tel" 
                                            required
                                            value={leadForm.phone}
                                            onChange={e => setLeadForm({...leadForm, phone: e.target.value})}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="070-123 45 67"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Meddelande (frivilligt)</label>
                                        <textarea 
                                            value={leadForm.message}
                                            onChange={e => setLeadForm({...leadForm, message: e.target.value})}
                                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none h-24"
                                            placeholder="Berätta gärna lite kort om era behov..."
                                        />
                                    </div>
                                    
                                    <button 
                                        type="submit" 
                                        disabled={isSubmittingLead}
                                        className={`w-full bg-primary text-black font-bold py-4 rounded-xl transition-all ${isSubmittingLead ? 'opacity-70 cursor-not-allowed' : 'hover:bg-teal-400 hover:shadow-[0_0_15px_-3px_rgba(20,184,166,0.4)]'}`}
                                    >
                                        {isSubmittingLead ? 'Skickar...' : 'Skicka förfrågan'}
                                    </button>
                                </form>
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </div>
    );
};
