import { Injectable, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Observer } from 'rxjs';
import { EventResponse, Acknowledgement } from './interfaces';

@Injectable({
  providedIn: 'root'
})
export class EventsService {

  private endPoint = isDevMode() ? '/api' : 'https://us-central1-ps-notify-api.cloudfunctions.net/api';

  constructor(private http: HttpClient) { }

  getAll(): Observable<EventResponse> {
    // tslint:disable-next-line: deprecation
    return Observable.create((observer: Observer<EventResponse>) => {
      const self = this;
      self.getLatest().subscribe(res => onNext(res), observer.error);

      function onNext(response: EventResponse) {
        observer.next(response);
        if (response.links.next) {
          self.getByRoute<EventResponse>(response.links.next).subscribe(res =>
            onNext(res), observer.error);
        } else {
          observer.complete();
        }
      }
    });
  }

  private getByRoute<T>(route: string): Observable<T> {
    const url = `${this.endPoint}${route}`;
    return this.http.get<T>(url);
  }

  getLatest(): Observable<EventResponse> {
    const route = '/latest';
    return this.getByRoute(route);
  }

  getById(id: number): Observable<EventResponse> {
    const route = `/event/${id}`;
    return this.getByRoute(route);
  }

  getAcknowledgements(event: EventResponse): Observable<Acknowledgement[]> {
    return this.getByRoute<Acknowledgement[]>(event.links.acknowledgements);
  }
}
