/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChefHat, MapPin, Utensils, BookOpen, Clock, AlertCircle, Loader2, Share2, Sparkles, X, Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { Mode, MealType, FullChefOutput, ChefResponse } from './types';
import { ALIMENTOS } from './constants';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [ingredientes, setIngredientes] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [tipoComida, setTipoComida] = useState<MealType>('comida');
  const [modo, setModo] = useState<Mode>('receta');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullChefOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPantryOpen, setIsPantryOpen] = useState(false);
  const [searchPantry, setSearchPantry] = useState('');

  const toggleIngredient = (ing: string) => {
    const currentList = ingredientes.split(',').map(s => s.trim()).filter(Boolean);
    if (currentList.includes(ing)) {
      setIngredientes(currentList.filter(item => item !== ing).join(', '));
    } else {
      setIngredientes([...currentList, ing].join(', '));
    }
  };

  const isIngSelected = (ing: string) => {
    return ingredientes.split(',').map(s => s.trim()).filter(Boolean).includes(ing);
  };

  const generateRecipe = async () => {
    setLoading(true);
    setError(null);
    try {
      const prompt = `
ROL
Actúa como chef profesional experto en cocina tradicional y antigua de cualquier parte del mundo. Dominas recetas auténticas, historia gastronómica y técnicas clásicas. Prohibido usar técnicas modernas o reinterpretaciones.

OBJETIVO
Generar recetas tradicionales auténticas, organizar menús (diarios o semanales), crear prompts de imagen realistas y devolver salida estructurada lista para app (JSON + HTML).

INPUT DEL USUARIO (VARIABLES)
ingredientes: ${ingredientes}
ubicacion: ${ubicacion}
tipo_comida: ${tipoComida}
modo: ${modo}

REGLAS ESTRICTAS
1. Usa SOLO recetas tradicionales reales o plausibles de la región.
2. Ajusta los ingredientes sin romper autenticidad.
3. No inventes platos irreales.
4. Explicación breve, ejecución clara.
5. Lenguaje profesional, directo.

SALIDA OBLIGATORIA (DOBLE FORMATO)
Devuelve un objeto JSON que contenga DOS campos: "json" (la estructura de datos solicitada) y "html" (el código HTML para renderizar).

1) JSON (PARA APP)
Devuelve SIEMPRE este esquema para el campo "json":
{
  "tipo": "${modo}",
  "ubicacion": "${ubicacion}",
  "recetas": [
    {
      "nombre": "",
      "region": "",
      "historia": "",
      "ingredientes": [],
      "preparacion": [],
      "tiempo": "",
      "dificultad": "",
      "imagen_prompt": "",
      "imagen_url": ""
    }
  ]
}

2) HTML (PARA WHATSAPP / WEB)
Genera HTML limpio, responsive y visual para el campo "html".
Requisitos HTML:
- Diseño tipo tarjeta.
- Contenido colapsable (usa <details>).
- Compatible móvil.
- Utiliza estilos inline para asegurar portabilidad máxima.
- Incluye un marcador de posición IMAGEN_URL para la imagen.

IMAGEN (OBLIGATORIO)
El campo imagen_prompt debe estar en inglés: “traditional [dish], authentic, rustic plating, natural light, high detail, food photography, top view, simple wooden table background”.

IMPORTANTE: Devuelve SOLO el JSON que contiene ambos formatos. No añadas texto fuera del JSON.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const parsedData = JSON.parse(response.text) as { json: ChefResponse, html: string };
      
      // Generate images for each recipe using nano banana pro or flash image
      const recipesWithImages = await Promise.all(parsedData.json.recetas.map(async (recipe) => {
        try {
          const imgRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: recipe.imagen_prompt,
          });
          
          let imageUrl = '';
          for (const part of imgRes.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            }
          }
          return { ...recipe, imagen_url: imageUrl };
        } catch (e) {
          console.error("Image generation failed", e);
          return recipe;
        }
      }));

      parsedData.json.recetas = recipesWithImages;

      // Update HTML with the final image urls
      let finalHtml = parsedData.html;
      recipesWithImages.forEach((r) => {
        if (r.imagen_url) {
          finalHtml = finalHtml.replace('IMAGEN_URL', r.imagen_url);
        }
      });

      setResult({ json: parsedData.json, html: finalHtml });
    } catch (err) {
      console.error(err);
      setError("Anselmo no ha podido recuperar la receta. Asegúrate de que los ingredientes y la ubicación sean correctos.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.html);
      alert("Receta HTML copiada para WhatsApp/Web");
    }
  };

  const downloadHtmlFile = () => {
    if (result) {
      const recipeTitle = result.json.recetas[0]?.nombre || 'Receta_Anselmo';
      const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${recipeTitle} - El Fogón de Anselmo</title>
    <style>
        body { 
          background-color: #F7F2EB; 
          margin: 0; 
          padding: 20px; 
          display: flex; 
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .container { max-width: 600px; width: 100%; }
        /* Reset para asegurar que el HTML del chef se vea bien */
        * { box-sizing: border-box; }
    </style>
</head>
<body>
    <div class="container">
        ${result.html}
    </div>
</body>
</html>`;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recipeTitle.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-parchment text-earth-dark font-sans selection:bg-accent-tan/30 pb-20">
      <header className="py-8 px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 border-b border-border-warm/50 mb-8">
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ rotate: -10, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            className="w-14 h-14 bg-terracotta rounded-xl flex items-center justify-center text-white font-serif text-3xl shadow-xl shadow-terracotta/20"
          >
            A
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-hero-dark uppercase">Anselmo</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-terracotta">El Fogón Antiguo · Tradiciones Milenarias</p>
          </div>
        </div>
        
        <nav className="bg-white rounded-full px-6 py-2 border border-border-warm shadow-sm flex gap-4 md:gap-8 items-center text-[10px] font-bold uppercase tracking-widest text-earth-dark/40">
          <button 
            onClick={() => setModo('receta')}
            className={`hover:text-terracotta transition-colors ${modo === 'receta' ? 'text-terracotta' : ''}`}
          >
            Receta
          </button>
          <button 
            onClick={() => setModo('menu_diario')}
            className={`hover:text-terracotta transition-colors ${modo === 'menu_diario' ? 'text-terracotta' : ''}`}
          >
            Diario
          </button>
          <button 
            onClick={() => setModo('menu_semanal')}
            className={`hover:text-terracotta transition-colors ${modo === 'menu_semanal' ? 'text-terracotta' : ''}`}
          >
            Semanal
          </button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Input Controls (Bento Sidebar) */}
        <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[2rem] p-8 border border-border-warm shadow-sm space-y-8">
            <div className="flex justify-between items-center border-b border-border-warm pb-4">
              <h3 className="text-xs uppercase tracking-widest text-terracotta font-bold">Preparar Mesa</h3>
              <button 
                onClick={() => setIsPantryOpen(true)}
                className="text-[10px] font-bold uppercase tracking-widest text-terracotta bg-parchment px-3 py-1.5 rounded-full hover:bg-terracotta hover:text-white transition-all flex items-center gap-1.5"
              >
                <Plus size={10} /> Abrir Dispensa
              </button>
            </div>
            
            <div className="space-y-6">
              <label className="block group">
                <span className="flex items-center gap-2 text-[10px] uppercase font-bold text-earth-dark/60 mb-2 transition-colors group-focus-within:text-terracotta">
                   <Utensils size={12} /> Despensa
                </span>
                <textarea 
                  className="w-full p-4 rounded-2xl border border-border-warm/60 font-sans text-sm h-32 focus:ring-1 focus:ring-terracotta focus:border-terracotta focus:outline-none bg-parchment/30 transition-all resize-none"
                  placeholder="¿Qué ingredientes tiene? (arroz, azafrán...)"
                  value={ingredientes}
                  onChange={(e) => setIngredientes(e.target.value)}
                />
              </label>

              <label className="block group">
                <span className="flex items-center gap-2 text-[10px] uppercase font-bold text-earth-dark/60 mb-2 transition-colors group-focus-within:text-terracotta">
                  <MapPin size={12} /> Geografía
                </span>
                <input 
                  type="text"
                  className="w-full p-4 rounded-2xl border border-border-warm/60 font-sans text-sm focus:ring-1 focus:ring-terracotta focus:border-terracotta focus:outline-none bg-parchment/30 transition-all"
                  placeholder="Región o Ciudad"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                />
              </label>

              <div className="space-y-4">
                <span className="flex items-center gap-2 text-[10px] uppercase font-bold text-earth-dark/60 mb-2">
                  <Clock size={12} /> Momento
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['desayuno', 'comida', 'cena'] as MealType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipoComida(t)}
                      className={`py-2 rounded-xl text-[10px] uppercase font-bold border transition-all ${
                        tipoComida === t 
                        ? 'bg-earth-dark text-white border-earth-dark shadow-md' 
                        : 'bg-white border-border-warm text-earth-dark/40 hover:border-terracotta hover:text-terracotta'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={generateRecipe}
              disabled={loading || !ubicacion}
              className="w-full py-5 bg-terracotta text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-terracotta/90 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-terracotta/20 active:scale-95"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>Consultar Archivo <Sparkles size={16} /></>
              )}
            </button>
          </div>

          <div className="bg-accent-tan/20 rounded-[2rem] p-8 border border-border-warm italic text-sm text-terracotta leading-relaxed shadow-inner">
            "La cocina honesta nace del fuego lento y el respeto al producto de la tierra. Anselmo solo conoce la verdad de los fogones antiguos."
          </div>
        </aside>

        {/* Results Area (Bento Content) */}
        <section className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {!loading && !result && !error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[600px] bg-white/40 rounded-[3rem] border border-dashed border-border-warm flex flex-col items-center justify-center text-center p-12 space-y-8"
              >
                <div className="relative group">
                  <div className="w-32 h-32 bg-border-warm/30 rounded-full flex items-center justify-center opacity-40 group-hover:scale-110 transition-transform duration-700">
                     <ChefHat size={64} strokeWidth={1} />
                  </div>
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-accent-tan/40 rounded-full flex items-center justify-center text-terracotta/40 animate-bounce">
                    <BookOpen size={20} />
                  </div>
                  <div className="absolute -bottom-2 -left-6 w-10 h-10 bg-terracotta/20 rounded-full flex items-center justify-center text-terracotta/30 animate-pulse">
                    <Sparkles size={16} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl font-serif italic text-hero-dark">El archivo está cerrado</h3>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-earth-dark/40 max-w-sm leading-loose mx-auto">
                    Especifique una ubicación y Anselmo buscará en sus pergaminos la sabiduría culinaria de sus antepasados.
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-8 pt-8 opacity-20">
                  <div className="flex flex-col items-center gap-2">
                    <Utensils size={24} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Ingredientes</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <MapPin size={24} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Región</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Clock size={24} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Tradición</span>
                  </div>
                </div>
              </motion.div>
            )}

            {loading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[600px] flex flex-col items-center justify-center gap-6"
              >
                <div className="relative">
                  <Loader2 className="animate-spin text-terracotta" size={64} strokeWidth={1} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ChefHat size={20} className="text-terracotta opacity-50" />
                  </div>
                </div>
                <p className="font-serif italic text-xl text-terracotta animate-pulse">Encendiendo los leños...</p>
              </motion.div>
            )}

            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {result.json.recetas.map((recipe, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Hero Bento Box */}
                    <div className="md:col-span-3 bg-white rounded-[2.5rem] overflow-hidden border border-border-warm shadow-sm flex flex-col md:flex-row h-full">
                      {recipe.imagen_url && (
                        <div className="md:w-1/2 relative h-64 md:h-auto overflow-hidden">
                          <img 
                            src={recipe.imagen_url} 
                            alt={recipe.nombre} 
                            className="w-full h-full object-cover grayscale-[0.1] hover:grayscale-0 transition-all duration-1000 scale-105 hover:scale-100"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 md:to-transparent" />
                        </div>
                      )}
                      <div className={`p-8 flex flex-col justify-center ${recipe.imagen_url ? 'md:w-1/2' : 'md:w-full'}`}>
                         <span className="text-[10px] font-bold uppercase tracking-widest text-terracotta mb-2 flex items-center gap-2">
                           <span className="w-4 h-[1px] bg-terracotta"></span> {recipe.region}
                         </span>
                         <h2 className="text-4xl md:text-5xl font-serif font-bold text-hero-dark leading-tight mb-4">{recipe.nombre}</h2>
                         <p className="text-sm font-serif italic text-earth-dark/70 leading-relaxed line-clamp-4">{recipe.historia}</p>
                      </div>
                    </div>

                    {/* Stats Bento Box */}
                    <div className="md:col-span-1 bg-hero-dark text-white rounded-[2.5rem] p-8 flex flex-col justify-between shadow-xl shadow-hero-dark/20 relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                          <div className="text-4xl font-serif italic text-accent-tan">{recipe.tiempo}</div>
                          <Clock size={24} className="text-accent-tan/40" />
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-2">Esfuerzo Sugerido</p>
                        <div className="text-lg font-bold text-accent-tan uppercase tracking-wider">{recipe.dificultad}</div>
                      </div>
                      <div className="absolute -bottom-4 -right-4 text-white/5 rotate-12">
                        <ChefHat size={120} />
                      </div>
                      <div className="mt-8 border-t border-white/10 pt-6 space-y-3">
                        <button 
                          onClick={copyToClipboard}
                          className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-accent-tan hover:text-hero-dark py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all group"
                        >
                          <Share2 size={14} className="group-hover:scale-110 transition-transform" /> Copiar Código
                        </button>
                        <button 
                          onClick={downloadHtmlFile}
                          className="w-full flex items-center justify-center gap-3 bg-accent-tan text-hero-dark hover:bg-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all group shadow-lg"
                        >
                          <BookOpen size={14} className="group-hover:scale-110 transition-transform" /> Descargar HTML
                        </button>
                      </div>
                    </div>

                    {/* Ingredients Bento Box */}
                    <div className="md:col-span-1 bg-white rounded-[2.5rem] p-8 border border-border-warm shadow-sm flex flex-col">
                      <h3 className="text-xs uppercase tracking-widest text-terracotta font-bold mb-6 flex items-center gap-2">
                        <Utensils size={14} /> Elementos
                      </h3>
                      <ul className="space-y-4 flex-grow">
                        {recipe.ingredientes.map((ing, i) => (
                          <li key={i} className="flex items-start gap-3 border-b border-border-warm/30 pb-3 text-sm group">
                            <span className="w-1.5 h-1.5 rounded-full bg-terracotta mt-1.5 transition-transform group-hover:scale-150" />
                            <span className="opacity-80 leading-tight">{ing}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Preparation Bento Box */}
                    <div className="md:col-span-3 bg-white rounded-[2.5rem] p-8 border border-border-warm shadow-sm flex flex-col">
                       <h3 className="text-xs uppercase tracking-widest text-terracotta font-bold mb-8 flex items-center gap-2">
                         <BookOpen size={14} /> El Arte del Ritual
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                          {recipe.preparacion.map((step, i) => (
                            <div key={i} className="flex gap-5 group">
                              <span className="w-8 h-8 rounded-full bg-parchment border border-border-warm text-terracotta flex items-center justify-center text-xs font-bold shrink-0 transition-colors group-hover:bg-terracotta group-hover:text-white group-hover:border-terracotta">
                                {i + 1}
                              </span>
                              <p className="text-sm leading-relaxed text-earth-dark/80 pt-1">{step}</p>
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* HTML Preview (Bento Bottom Span) */}
                    <div className="md:col-span-4 bg-accent-tan/10 rounded-[2rem] p-6 border border-dashed border-terracotta/30">
                       <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-terracotta/50">Receta Maquetada para Anselmo</span>
                          <div className="h-[1px] flex-grow mx-4 bg-terracotta/10"></div>
                       </div>
                       <div 
                          className="bg-white/60 p-6 rounded-2xl max-h-60 overflow-y-auto custom-scrollbar"
                          dangerouslySetInnerHTML={{ __html: result.html }}
                       />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <footer className="mt-16 text-center border-t border-border-warm/40 pt-12">
        <p className="text-[10px] uppercase font-bold tracking-[0.5em] text-earth-dark/30">
          Custodio Anselmo · Sabor de Antaño
        </p>
      </footer>

      {/* Pantry Modal */}
      <AnimatePresence>
        {isPantryOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-parchment"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex flex-col overflow-hidden"
            >
              <header className="p-4 md:p-6 border-b border-border-warm flex flex-col md:flex-row justify-between items-center gap-4 bg-white shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-terracotta rounded-lg flex items-center justify-center text-white shadow-lg rotate-3">
                    <ChefHat size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-serif font-bold text-hero-dark">La Dispensa</h2>
                    <p className="text-[8px] uppercase font-bold tracking-[0.4em] text-terracotta opacity-80">Inventario de Anselmo</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-grow md:w-64">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-earth-dark/30" />
                    <input 
                      type="text"
                      placeholder="Buscar..."
                      className="w-full pl-10 pr-4 py-2 bg-parchment rounded-xl text-xs font-sans border border-border-warm focus:outline-none focus:ring-1 focus:ring-terracotta/20 transition-all shadow-inner"
                      value={searchPantry}
                      onChange={(e) => setSearchPantry(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setIsPantryOpen(false)}
                    className="p-2 rounded-lg hover:bg-parchment text-hero-dark hover:text-terracotta transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              <div className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar bg-[#fdfaf5]">
                <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {ALIMENTOS.map((cat, idx) => {
                    const filteredItems = cat.items 
                      ? cat.items.filter(i => i.toLowerCase().includes(searchPantry.toLowerCase()))
                      : [];
                    
                    const filteredSubCats = cat.subcategorias 
                      ? cat.subcategorias.map(sc => ({
                          ...sc,
                          items: sc.items.filter(i => i.toLowerCase().includes(searchPantry.toLowerCase()))
                        })).filter(sc => sc.items.length > 0)
                      : [];

                    if (searchPantry && filteredItems.length === 0 && filteredSubCats.length === 0) return null;

                    return (
                      <motion.div 
                        key={idx} 
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="space-y-5 bg-white p-6 rounded-[2rem] border border-border-warm shadow-sm hover:shadow-md transition-shadow"
                      >
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-terracotta border-b border-border-warm/50 pb-3 flex items-center justify-between">
                          {cat.categoria}
                          <span className="text-[9px] bg-parchment px-2 py-0.5 rounded-full text-earth-dark/40">
                            {cat.items ? cat.items.length : cat.subcategorias?.reduce((acc, sc) => acc + sc.items.length, 0)}
                          </span>
                        </h4>
                        
                        {cat.items && (
                          <div className="flex flex-wrap gap-2">
                            {(searchPantry ? filteredItems : cat.items).map(item => (
                              <button
                                key={item}
                                onClick={() => toggleIngredient(item)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-all duration-300 ${
                                  isIngSelected(item)
                                  ? 'bg-terracotta text-white border-terracotta shadow-lg shadow-terracotta/20 scale-105'
                                  : 'bg-parchment/50 text-earth-dark border-border-warm hover:border-terracotta hover:bg-white'
                                }`}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        )}

                        {cat.subcategorias && (searchPantry ? filteredSubCats : cat.subcategorias).map(sc => (
                          <div key={sc.nombre} className="space-y-3 pt-1">
                            <h5 className="text-[9px] uppercase font-bold text-earth-dark/50 italic flex items-center gap-2">
                              <span className="w-3 h-[1px] bg-border-warm"></span> {sc.nombre}
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {sc.items.map(item => (
                                <button
                                  key={item}
                                  onClick={() => toggleIngredient(item)}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-all duration-300 ${
                                    isIngSelected(item)
                                    ? 'bg-terracotta text-white border-terracotta shadow-lg shadow-terracotta/20 scale-105'
                                    : 'bg-parchment/50 text-earth-dark border-border-warm hover:border-terracotta hover:bg-white'
                                  }`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <footer className="p-4 md:p-6 border-t border-border-warm bg-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-4">
                  <div className="text-center md:text-left">
                    <div className="text-xl font-serif font-bold text-hero-dark">{ingredientes.split(',').filter(Boolean).length}</div>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-terracotta">Cesta</p>
                  </div>
                  <div className="hidden md:block h-8 w-[1px] bg-border-warm"></div>
                  <div className="hidden md:flex flex-wrap gap-1 max-w-lg">
                    {ingredientes.split(',').filter(Boolean).slice(0, 15).map(ing => (
                      <span key={ing} className="bg-parchment text-[7px] uppercase font-bold px-1.5 py-0.5 rounded-full text-earth-dark/60 flex items-center gap-1 border border-border-warm/50">
                        {ing} <X size={6} className="cursor-pointer hover:text-terracotta" onClick={() => toggleIngredient(ing.trim())} />
                      </span>
                    ))}
                    {ingredientes.split(',').filter(Boolean).length > 15 && <span className="text-[7px] text-earth-dark/40">...</span>}
                  </div>
                </div>
                <button 
                  onClick={() => setIsPantryOpen(false)}
                  className="w-full md:w-auto px-8 py-2.5 bg-terracotta text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-hero-dark transition-all shadow-lg shadow-terracotta/10 active:scale-95"
                >
                  Cerrar y Cocinar
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D9CFC1; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #7D2D12; }
      `}} />
    </div>
  );
}
