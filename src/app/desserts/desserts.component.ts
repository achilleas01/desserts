import { Component, computed, effect, inject, linkedSignal, resource, ResourceStatus, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dessert } from '../data/dessert';
import { DessertService } from '../data/dessert.service';
import { DessertIdToRatingMap, RatingService } from '../data/rating.service';
import { DessertCardComponent } from '../dessert-card/dessert-card.component';
import { ToastService } from '../shared/toast';
import { wait } from '../shared/wait';
import { debounceTrue } from '../shared/resource-utils';
import { getErrorMessage } from '../shared/get-error-message';

@Component({
  selector: 'app-desserts',
  standalone: true,
  imports: [DessertCardComponent, FormsModule],
  templateUrl: './desserts.component.html',
  styleUrl: './desserts.component.css',
})
export class DessertsComponent {

  #dessertService = inject(DessertService);
  #ratingService = inject(RatingService);
  #toastService = inject(ToastService);

  originalName = signal('');
  englishName = signal('');

  dessertsCriteria = computed(() => ({
    originalName: this.originalName(),
    englishName: this.englishName(),
  }));

  dessertsResource = resource({
    request: this.dessertsCriteria,
    loader: async (param) => {
      await wait(300);
      return await this.#dessertService.findPromise(param.request, param.abortSignal);
    }
  });

  desserts = computed(() => this.dessertsResource.value() ?? []);

  ratingsResource = resource({
    loader: (param) => {
      if (param.previous.status === ResourceStatus.Idle) {
        return Promise.resolve(undefined);
      }
      return this.#ratingService.loadExpertRatingsPromise();
    }
  });

  ratings = linkedSignal(() => this.ratingsResource.value() ?? {});

  ratedDesserts = computed(() => this.toRated(this.desserts(), this.ratings()));
  loading = debounceTrue(() => this.ratingsResource.isLoading() || this.dessertsResource.isLoading(), 500);

  error = computed(() => getErrorMessage(this.dessertsResource.error() || this.ratingsResource.error()));

  constructor() {
    effect(() => {
      const error = this.error();
      if (error) {
        this.#toastService.show('Error: ' + error);
      }
    })
  }

  toRated(desserts: Dessert[], ratings: DessertIdToRatingMap): Dessert[] {
    return desserts.map((d) =>
      ratings[d.id] ? { ...d, rating: ratings[d.id] } : d,
    );
  }

  loadRatings(): void {
    this.ratingsResource.reload();
  }

  updateRating(id: number, rating: number): void {
    this.ratings.update((ratings) => ({
      ...ratings,
      [id]: rating,
    }));
  }
}
