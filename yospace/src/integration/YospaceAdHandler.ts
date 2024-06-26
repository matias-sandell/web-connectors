import type { ChromelessPlayer } from 'theoplayer';
import { AnalyticEventObserver, SessionErrorCode } from '../yospace/AnalyticEventObserver';
import { AdBreak, AdVert, ResourceType } from '../yospace/AdBreak';
import { YospaceUiHandler } from './YospaceUIHandler';
import { YoSpaceLinearAd, YoSpaceNonLinearAd } from './YospaceAd';
import { YospaceManager } from './YospaceManager';
import { arrayRemove } from '../utils/DefaultEventDispatcher';
import { TrackingError } from '../yospace/TrackingError';
import { YospaceSessionManager } from '../yospace/YospaceSessionManager';

export class YospaceAdHandler {
    private yospaceManager: YospaceManager;

    private uiHandler: YospaceUiHandler;

    private player: ChromelessPlayer;

    private advertStartListener: (() => void | undefined) | undefined;

    private analyticEventObservers: AnalyticEventObserver[] = [];

    constructor(yospaceManager: YospaceManager, uiHandler: YospaceUiHandler, player: ChromelessPlayer) {
        this.yospaceManager = yospaceManager;
        this.uiHandler = uiHandler;
        this.player = player;
        this.initialiseAdSession();
    }

    registerAnalyticEventObserver(analyticsEventObserver: AnalyticEventObserver) {
        this.analyticEventObservers.push(analyticsEventObserver);
    }

    unregisterAnalyticEventObserver(analyticsEventObserver: AnalyticEventObserver) {
        arrayRemove(this.analyticEventObservers, analyticsEventObserver);
    }

    private onAdvertStart(advert: AdVert) {
        if (this.advertStartListener) {
            this.player.removeEventListener('play', this.advertStartListener);
            this.advertStartListener = undefined;
        }

        const linearCreative = advert.getLinearCreative();
        if (linearCreative) {
            this.uiHandler.createLinearClickThrough(new YoSpaceLinearAd(linearCreative.getClickThroughUrl()));
        }

        const nonLinearCreatives = advert.getNonLinearCreativesByType(ResourceType.STATIC);
        nonLinearCreatives.forEach((nonLinearCreative) => {
            const nonlinearUrl = nonLinearCreative.getResource(ResourceType.STATIC);
            if (nonlinearUrl) {
                this.uiHandler.createNonLinear(
                    new YoSpaceNonLinearAd(nonLinearCreative.getClickThroughUrl(), nonlinearUrl.getStringData())
                );
            }
        });
    }

    /**
     * Registers a callback object to the session manager which receives new advert events.
     */
    private initialiseAdSession(): void {
        const callbackObject: AnalyticEventObserver = {
            onAdvertBreakEarlyReturn: (adBreak: AdBreak, session: YospaceSessionManager) => {
                this.analyticEventObservers.forEach((observer: AnalyticEventObserver) =>
                    observer.onAdvertBreakEarlyReturn(adBreak, session)
                );
            },
            onAdvertBreakStart: (adBreak: AdBreak, session: YospaceSessionManager) => {
                this.analyticEventObservers.forEach((observer: AnalyticEventObserver) =>
                    observer.onAdvertBreakStart(adBreak, session)
                );
            },
            onAdvertBreakEnd: (session: YospaceSessionManager) => {
                this.analyticEventObservers.forEach((observer) => observer.onAdvertBreakEnd(session));
            },
            onAdvertStart: (advert: AdVert, session: YospaceSessionManager) => {
                if (this.yospaceManager.startedPlaying) {
                    this.onAdvertStart(advert);
                } else {
                    this.advertStartListener = () => {
                        this.onAdvertStart(advert);
                    };
                    this.player.addEventListener('play', this.advertStartListener);
                }
                this.analyticEventObservers.forEach((observer) => observer.onAdvertStart(advert, session));
            },
            onAdvertEnd: (session: YospaceSessionManager) => {
                // Function gets called at the end of each advert within a break.
                this.uiHandler.removeAllAds();
                this.analyticEventObservers.forEach((observer) => observer.onAdvertEnd(session));
            },
            onSessionError: (error: SessionErrorCode, session: YospaceSessionManager) => {
                this.analyticEventObservers.forEach((observer) => observer.onSessionError(error, session));
            },
            onAnalyticUpdate: (session: YospaceSessionManager) => {
                this.analyticEventObservers.forEach((observer) => observer.onAnalyticUpdate(session));
            },
            onTrackingEvent: (type: string, session: YospaceSessionManager) => {
                this.analyticEventObservers.forEach((observer) => observer.onTrackingEvent(type, session));
            },
            onTrackingError: (error: TrackingError, session: YospaceSessionManager) => {
                this.analyticEventObservers.forEach((observer) => observer.onTrackingError(error, session));
            }
        };
        this.yospaceManager.sessionManager?.addAnalyticObserver(callbackObject);
    }

    reset(): void {
        this.analyticEventObservers = [];
        this.uiHandler.reset();
    }
}
