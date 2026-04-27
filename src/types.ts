/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Mode = 'receta' | 'menu_diario' | 'menu_semanal';
export type MealType = 'desayuno' | 'comida' | 'cena';

export interface Recipe {
  nombre: string;
  region: string;
  historia: string;
  ingredientes: string[];
  preparacion: string[];
  tiempo: string;
  dificultad: string;
  imagen_prompt: string;
  imagen_url: string;
}

export interface ChefResponse {
  tipo: Mode;
  ubicacion: string;
  recetas: Recipe[];
}

export interface FullChefOutput {
  json: ChefResponse;
  html: string;
}
