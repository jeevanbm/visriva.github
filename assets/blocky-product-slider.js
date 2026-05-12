/**
  © BlockyApps. You are permitted to use this content within your store. Redistribution or use in any other application is strictly prohibited.
  Unauthorized copying, distribution, or reproduction in any form will result in legal action.
**/

if (!customElements.get('blocky-product-slider')) {
  customElements.define(
    'blocky-product-slider',
    class BlockyProductSlider extends HTMLElement {
      constructor() {
        super();

        this.handleClick = this.handleClick.bind(this);
        this.handleRunBefore = this.handleRunBefore.bind(this);
        this.handleRunAfter = this.handleRunAfter.bind(this);
      }

      connectedCallback() {
        if (this.sliderReady) return;

        this.glideEl = this.querySelector('.product-slider-glide');
        if (!this.glideEl) return;

        this.slides = Array.from(this.glideEl.querySelectorAll('.glide__slide'));
        if (!this.slides.length || typeof Glide === 'undefined') return;

        this.slideCount = this.slides.length;
        this.videoAutoplay = this.getAttribute('data-video-autoplay') === 'true';
        this.isMuted = this.getAttribute('data-video-muted') !== 'false';
        this.videoLoop = this.getAttribute('data-video-loop') === 'true';
        this.sliderReady = true;
        this.assignSlideIndexes();

        try {
          this.glide = new Glide(this.glideEl, this.getOptions());
          this.glide.on('run.before', this.handleRunBefore);
          this.glide.on('run.after', this.handleRunAfter);
          this.glide.mount();
        } catch (e) {
          this.sliderReady = false;
          this.glide = null;
          return;
        }

        this.glideEl.addEventListener('click', this.handleClick);
        this.setVisualActive(this.glide.index);
        this.syncMedia();
      }

      disconnectedCallback() {
        this.destroy();
      }

      assignSlideIndexes() {
        this.slides.forEach(function (slideEl, index) {
          slideEl.setAttribute('data-slide-index', index);
        });
      }

      getOptions() {
        var perView = parseInt(this.glideEl.getAttribute('data-slides-per-view') || '5', 10);
        var animationMs = parseInt(this.getAttribute('data-animation-ms') || '500', 10);

        return {
          type: 'carousel',
          focusAt: 'center',
          perView: perView,
          startAt: Math.floor(this.slideCount / 2),
          gap: parseInt(getComputedStyle(this).getPropertyValue('--ps-gap') || '16', 10) || 16,
          animationDuration: Math.max(200, animationMs),
          dragThreshold: 100,
          swipeThreshold: 100,
          peek: { before: 40, after: 40 },
          rewind: true,
          autoplay: this.glideEl.getAttribute('data-autoplay') === 'true'
            ? parseInt(this.glideEl.getAttribute('data-autoplay-speed') || '4000', 10)
            : false,
          breakpoints: {
            1600: {
              perView: perView,
            },
            1400: {
              perView: Math.max(1, perView - 1),
            },
            1200: {
              perView: 3,
            },
            1000: {
              perView: 2,
              peek: { before: 30, after: 30 },
            },
            600: {
              perView: 1.5,
              peek: { before: 30, after: 30 },
            },
          },
        };
      }

      clampIndex(index) {
        if (this.slideCount <= 0) return 0;
        return ((index % this.slideCount) + this.slideCount) % this.slideCount;
      }

      getSlideVideo(slideEl) {
        return slideEl ? slideEl.querySelector('video.product-slider-slide__video') : null;
      }

      getRenderedSlides() {
        return Array.from(this.glideEl.querySelectorAll('.glide__slide[data-slide-index]'));
      }

      getCurrentActiveSlide() {
        var currentIndex = this.clampIndex(this.glide ? this.glide.index : 0);
        return (
          this.glideEl.querySelector('.glide__slide--active[data-slide-index="' + currentIndex + '"]') ||
          this.glideEl.querySelector('.glide__slide[data-slide-index="' + currentIndex + '"]')
        );
      }

      applySoundButtonClass(buttonEl) {
        if (!buttonEl) return;

        if (this.isMuted) buttonEl.classList.remove('is-sound-on');
        else buttonEl.classList.add('is-sound-on');
      }

      syncSoundButtons() {
        this.querySelectorAll('[data-sound-toggle]').forEach(
          function (buttonEl) {
            this.applySoundButtonClass(buttonEl);
          }.bind(this)
        );
      }

      setVisualActive(activeIndex) {
        var normalizedIndex = this.clampIndex(activeIndex);

        this.getRenderedSlides().forEach(function (slideEl) {
          var slideIndex = parseInt(slideEl.getAttribute('data-slide-index') || '-1', 10);
          if (slideIndex === normalizedIndex) slideEl.classList.add('is-current');
          else slideEl.classList.remove('is-current');
        });
      }

      pauseInactiveVideos(activeSlide) {
        this.getRenderedSlides().forEach(
          function (slideEl) {
            var videoEl = this.getSlideVideo(slideEl);
            if (!videoEl || slideEl === activeSlide) return;

            try {
              videoEl.pause();
              videoEl.muted = true;
            } catch (e) {}
          }.bind(this)
        );
      }

      pauseAllVideos() {
        this.pauseInactiveVideos(null);
      }

      async playActiveVideo(activeSlide) {
        var videoEl = this.getSlideVideo(activeSlide);
        if (!videoEl) return;

        videoEl.loop = !!this.videoLoop;
        videoEl.muted = !!this.isMuted;

        if (!this.videoAutoplay) return;

        try {
          var playResult = videoEl.play();
          if (playResult && typeof playResult.then === 'function') {
            await playResult;
          }
        } catch (e) {
          // Ignore autoplay rejection
        }
      }

      syncMedia() {
        var activeSlide = this.getCurrentActiveSlide();

        this.syncSoundButtons();
        this.pauseInactiveVideos(activeSlide);

        if (!activeSlide) return;

        this.playActiveVideo(activeSlide);
      }

      toggleMute() {
        this.isMuted = !this.isMuted;
        this.syncSoundButtons();
        return this.isMuted;
      }

      getTargetIndex(move) {
        if (!move || !this.glide) return 0;

        var direction = move.direction;
        var rawSteps = move.steps;
        var steps = parseInt(rawSteps, 10) || 1;

        if (direction === '=') return this.clampIndex(steps);
        if (direction === '>') return this.clampIndex(this.glide.index + steps);
        if (direction === '<') return this.clampIndex(this.glide.index - steps);
        return this.clampIndex(this.glide.index);
      }

      moveTo(index) {
        var targetIndex = this.clampIndex(index);

        this.setVisualActive(targetIndex);
        if (!this.glide) return;
        if (this.glide.index === targetIndex) {
          this.syncMedia();
          return;
        }

        this.glide.go('=' + targetIndex);
      }

      handleRunBefore(move) {
        this.setVisualActive(this.getTargetIndex(move));
      }

      handleRunAfter() {
        this.setVisualActive(this.glide.index);
        this.syncMedia();
      }

      handleClick(event) {
        var slideEl = event.target.closest('.glide__slide[data-slide-index]');
        if (!slideEl || !this.glideEl.contains(slideEl) || !this.glide) return;

        var slideIndex = parseInt(slideEl.getAttribute('data-slide-index') || '-1', 10);
        if (slideIndex < 0) return;

        if (event.target.closest('[data-sound-toggle]')) {
          event.preventDefault();
          event.stopPropagation();

          this.toggleMute();
          if (this.glide.index !== slideIndex) {
            this.moveTo(slideIndex);
            return;
          }

          this.syncMedia();
          return;
        }

        this.moveTo(slideIndex);
      }

      destroy() {
        if (this.glideEl) {
          this.glideEl.removeEventListener('click', this.handleClick);
        }

        this.pauseAllVideos();

        if (this.glide) {
          this.glide.destroy();
          this.glide = null;
        }

        this.sliderReady = false;
      }
    }
  );
}
