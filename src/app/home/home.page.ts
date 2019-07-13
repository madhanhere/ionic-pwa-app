// core imports
import { Component, OnDestroy, OnInit, ApplicationRef } from '@angular/core';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import { SwUpdate, UpdateAvailableEvent, UpdateActivatedEvent } from '@angular/service-worker';
// rxjs imports
import { Subscription, interval, concat } from 'rxjs';
import { first } from 'rxjs/operators';
import { Network } from '@ngx-pwa/offline';
// project imports
import { EventResponse } from '../interfaces';
import { EventsService } from '../events.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {

  events: EventResponse[] = [];
  subscriptions: Subscription[] = [];
  online$ = this.network.onlineChanges;

  constructor(private eventService: EventsService,
              private nav: NavController,
              private network: Network,
              private updater: SwUpdate,
              private toastController: ToastController,
              private alertController: AlertController,
              private appRef: ApplicationRef) { }

  ngOnInit(): void {
    this.subscriptions.push(this.eventService.getAll().subscribe(e => this.events.push(e)));
    this.initUpdater();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getEvents(): EventResponse[] {
    if (this.events && this.events.length) {
      return this.events.sort((a, b) => a.event.created > b.event.created ? -1 : 1);
    }
    return [];
  }

  details(response: EventResponse): void {
    this.nav.navigateForward(`/details/${response.event.id}`);
  }

  initUpdater(): void {
    const updateInterval$ = interval(1000 * 60 * 1); // one minute not recommended
    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true));
    const appStableInterval$ = concat(appIsStable$, updateInterval$);

    this.subscriptions.push(this.updater.activated.subscribe(e => this.onUpdateActivated(e)));
    this.subscriptions.push(this.updater.available.subscribe(e => this.onUpdateAvailable(e)));
    this.subscriptions.push(appStableInterval$.subscribe(() => { this.checkForUpdate(); }));
  }

  async onUpdateActivated(e: UpdateActivatedEvent) {
    await this.showToastMessage('Application updating...');
  }

  async onUpdateAvailable(e: UpdateAvailableEvent) {
    const updateMessage = e.available.appData['updateMessage'];

    const alert = await this.alertController.create({
      header: 'Update Available',
      message: 'A new version of app available. ' +
        `(Details: ${updateMessage}) ` + ' Click Ok to save now.',
      buttons: [
        {
          text: 'Not now',
          role: 'Cancel',
          cssClass: 'secondary',
          handler: async () => {
            await this.showToastMessage('Update differed');
          }
        }, {
          text: 'Ok',
          handler: async () => {
            this.updater.activateUpdate();
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      ]
    });

    await alert.present();

  }

  async showToastMessage(msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 2000,
      showCloseButton: true,
      position: 'top',
      closeButtonText: 'Ok'
    });
    toast.present();
  }

  async checkForUpdate() {
    if (this.updater.isEnabled) {
      await this.updater.checkForUpdate();
    }
  }

  async doRefresh(event) {
    try {
      const maxEvent = this.events.reduce((prev, current) =>
        (prev.event.id > current.event.id) ? prev : current);
      const maxEventId = +maxEvent.event.id + 1;
      const response = await this.eventService.getById(maxEventId).toPromise();
      this.events.push(response);
    } catch (error) {
      console.log(error);
    } finally {
      event.target.complete();
    }
  }
}
