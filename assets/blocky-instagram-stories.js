/**
  © BlockyApps. You are permitted to use this content within your store. Redistribution or use in any other application is strictly prohibited. 
  Unauthorized copying, distribution, or reproduction in any form will result in legal action.
**/
if (!customElements.get('blocky-insta')) {
  class BlockyInsta extends HTMLElement {
    constructor() {
      super();
      this.initVariables();
      this.addEventListeners();
      this.initStories();
      this.initSlider();
    }

    initVariables() {
      this.openButtons = this.querySelectorAll(".blocky-insta-story-btn");
      this.openButtonsOverflowContainer = this.querySelector(".blocky-insta-buttons-overflow-container");
      this.openButtonsContainer = this.querySelector(".blocky-insta-buttons");
      this.openBtnsPrev = this.querySelector(".blocky-insta-arrow-btn-prev");
      this.openBtnsNext = this.querySelector(".blocky-insta-arrow-btn-next");
      this.modal = this.querySelector(".blocky-insta-modal");
      this.slider = this.querySelector(".blocky-insta-slider");
      this.stories = this.querySelectorAll(".blocky-insta-story");
      this.prevBtns = this.querySelectorAll(".blocky-insta-story-prev");
      this.nextBtns = this.querySelectorAll(".blocky-insta-story-next");
      this.pauseResumeBtns = this.querySelectorAll(".blocky-insta-story-pause-resume-btn");
      this.volumeBtns = this.querySelectorAll(".blocky-insta-story-volume-btn");

      this.activeIndex = 0;
      this.storiesCnt = parseInt(this.dataset.stories);
      this.isPaused = false;
      this.isMuted = true;
      this.activeStory = this.stories[this.activeIndex];
      this.autoplayTimeout = null,
      this.autoplayStartTime = null
    }

    addEventListeners() {      
      this.openButtons.forEach(button => { button.addEventListener("click", this.openModal.bind(this)) });
      this.querySelectorAll(".blocky-insta-close-button").forEach(button => { button.addEventListener("click", this.closeModal.bind(this)) });
      this.prevBtns.forEach(button => { button.addEventListener("click", this.goToPrevMedia.bind(this)) });
      this.nextBtns.forEach(button => { button.addEventListener("click", this.goToNextMedia.bind(this)) });
      this.querySelectorAll(".blocky-insta-story-slide-btn").forEach(button => { button.addEventListener("click", this.slideBtnClick.bind(this)) });
      this.pauseResumeBtns.forEach(button => { button.addEventListener("click", this.togglePauseResume.bind(this)) });
      this.volumeBtns.forEach(button => { button.addEventListener("click", this.toggleMuted.bind(this)) });
      document.addEventListener("keydown", this.onKeyEvents.bind(this));
      this.slider.addEventListener("touchstart", this.onTouchStart.bind(this));
      this.slider.addEventListener("touchend", this.onTouchEnd.bind(this));
    }
    
    startAutoplay() {
      let story = this.activeStory;
      let mediaIndex = parseInt(story.dataset.activeMediaIndex);
      let mediaElement = story.querySelectorAll(".blocky-insta-story-media")[mediaIndex];
      let duration = 1000 * parseInt(mediaElement.getAttribute("data-duration"));
      
      this.updateProgressBars(mediaIndex);
      this.autoplayStartTime = Date.now();
      this.autoplayTimeout = setTimeout(() => {
        this.goToNextMedia();
      }, duration);
    }
  
    goToPrevMedia() {
      let story = this.activeStory;
      if (story.dataset.activeMediaIndex === "0") {
        this.changeActiveStory(this.activeIndex - 1);
      } else {
        this.changeActiveMedia(parseInt(story.dataset.activeMediaIndex) - 1);
      }
    }
  
    goToNextMedia() {
      let story = this.activeStory;
      if (story.dataset.activeMediaIndex === story.dataset.lastMediaIndex) {
        this.changeActiveStory(this.activeIndex + 1);
      } else {
        this.changeActiveMedia(parseInt(story.dataset.activeMediaIndex) + 1);
      }
    }
  
    slideBtnClick(event) {
      this.changeActiveStory(parseInt(event.currentTarget.dataset.index));
    }
  
    changeActiveStory(index) {
      clearTimeout(this.autoplayTimeout);
  
      if (index > this.storiesCnt || index < 0) return;
  
      let previousStory = this.stories[this.activeIndex];
      let mediaIndex = parseInt(previousStory.dataset.activeMediaIndex);
  
      if (previousStory.dataset.played === "true" || mediaIndex > 0) {
        let progressItem = previousStory.querySelectorAll(".blocky-insta-story-progress-item")[mediaIndex];
        if (progressItem) {
          progressItem.classList.remove("blocky-insta-story-progress-item-active");
          if (index > this.activeIndex) {
            progressItem.classList.add("blocky-insta-story-progress-item-completed");
          }
        }
      }
  
      let mediaElement = previousStory.querySelectorAll(".blocky-insta-story-media")[mediaIndex];
      if (mediaElement && mediaElement.getAttribute("data-type") === "video") {
        let video = mediaElement.querySelector("video");
        if (video) {
          video.pause();
          if (!this.isPaused) {
            video.currentTime = 0;
          }
        }
      }
  
      this.activeIndex = index;
      this.activeStory = this.stories[this.activeIndex];
  
      this.stories.forEach(story => {
        story.classList.remove("blocky-insta-story-active");
      });
  
      this.activeStory.classList.add("blocky-insta-story-active");
      this.activeStory.dataset.played = "true";
      if (this.storiesCnt >= 2) {
        this.slider.style.transform = `translateX(calc(var(--story-width) * ${-1 * this.activeIndex + 1}`;
      } else {
        this.slider.parentElement.style.transition = "transform .3s"
        this.slider.parentElement.style.transform = `translateX(calc(var(--story-width) * ${-1 * this.activeIndex + (this.storiesCnt * .5)}`
      }
  
      let newMediaIndex = parseInt(this.activeStory.dataset.activeMediaIndex, 10);
      this.changeActiveMedia(newMediaIndex);
      this.updateProgressBars(newMediaIndex);
    }
  
    changeActiveMedia(index) {
      clearTimeout(this.autoplayTimeout);
  
      if (index < 0) return;
  
      let story = this.activeStory;
      let lastMediaIndex = parseInt(story.dataset.lastMediaIndex);
  
      if (index > lastMediaIndex) return;
  
      story.dataset.activeMediaIndex = index;
      let mediaElements = story.querySelectorAll(".blocky-insta-story-media");
  
      mediaElements.forEach((media, mediaIndex) => {
        if (mediaIndex === index) {
          media.style.display = "block";
          if (media.getAttribute("data-type") === "video") {
            let video = media.querySelector("video");
            if (video && !this.isPaused) {
              video.play();
            }
          }
          story.querySelector(".blocky-insta-story-time-posted").innerHTML = media.dataset.timePosted;
        } else {
          media.style.display = "";
          if (media.getAttribute("data-type") === "video") {
            let video = media.querySelector("video");
            if (video) {
              video.pause();
              if (!this.isPaused) {
                  video.currentTime = 0;
              }
            }
          }
        }
      });
  
      this.updateProgressBars(index);
  
      if (!this.isPaused) {
        this.startAutoplay();
      }
  
      let prevButtons = story.querySelectorAll(".blocky-insta-story-prev");
      let nextButtons = story.querySelectorAll(".blocky-insta-story-next");
  
      prevButtons.forEach(button => {
        if (this.activeIndex === 0 && index === 0) {
          button.setAttribute("disabled", "");
        } else {
          button.removeAttribute("disabled");
        }
      });
  
      nextButtons.forEach(button => {
        if (this.activeIndex === this.storiesCnt && index === lastMediaIndex) {
          button.setAttribute("disabled", "");
        } else {
          button.removeAttribute("disabled");
        }
      });
    }
  
    updateProgressBars(index) {
      let progressItems = this.activeStory.querySelectorAll(".blocky-insta-story-progress-item");
  
      progressItems.forEach((item, itemIndex) => {
        item.classList.remove("blocky-insta-story-progress-item-completed", "blocky-insta-story-progress-item-active");
        if (itemIndex < index) {
          item.classList.add("blocky-insta-story-progress-item-completed");
        } else if (itemIndex === index) {
          item.classList.add("blocky-insta-story-progress-item-active");
        }
      });
    }
  
    openModal(event) {
      this.modal.dataset.open = "true";
      document.body.classList.add("blocky-overflow-hidden");
      this.changeActiveStory(parseInt(event.currentTarget.dataset.index));
    }
  
    closeModal() {
      this.querySelectorAll("video").forEach(video => {
        video.pause();
      });
      this.modal.dataset.open = "false";
      document.body.classList.remove("blocky-overflow-hidden");
      clearTimeout(this.autoplayTimeout);
    }
  
    initSlider() {
      if (this.openButtonsOverflowContainer.clientWidth > this.openButtonsContainer.clientWidth) return;
      const isTouchDevice = () => "ontouchstart" in window || navigator.maxTouchPoints;
      const buttonWidth = parseFloat(getComputedStyle(this.openButtons[0]).width);
      const columnGap = parseFloat(getComputedStyle(this.openButtonsContainer).columnGap);
      const visibleButtons = Math.floor(this.openButtonsOverflowContainer.clientWidth / (buttonWidth + columnGap));
      const scrollAmount =  (visibleButtons - 1) * (buttonWidth + columnGap);
      let startX = 0, initialOffset = 0, currentOffset = 0;
    
      const updateNavButtonVisibility = () => {
        const scrollLeft = this.openButtonsOverflowContainer.scrollLeft;
        const isAtStart = scrollLeft <= 0;
        const isAtEnd = scrollLeft > this.openButtonsOverflowContainer.scrollWidth - this.openButtonsContainer.clientWidth;
    
        this.openBtnsPrev.style.display = isAtStart ? "none" : "grid";
        this.openBtnsNext.style.display = isAtEnd ? "none" : "grid";
      };
    
      const startDrag = (e) => {
        this.isDragging = true;
        startX = e.touches[0].clientX - currentOffset;
      };
    
      const moveDrag = (e) => {
        if (!this.isDragging) return;
        const offset = e.touches[0].clientX - startX;
    
        if (offset < 0 && Math.abs(offset) <= this.openButtonsContainer.offsetWidth - this.openButtonsOverflowContainer.offsetWidth) {
          this.openButtonsContainer.style.transform = `translateX(${offset}px)`;
          initialOffset = offset;
        }
      };
    
      const endDrag = () => {
        this.isDragging = false;
        currentOffset = initialOffset;
      };
    
      const prevButtonClick = () => {
        this.openButtonsOverflowContainer.scrollBy({
          left: -scrollAmount,
          behavior: "smooth"
        });
        setTimeout(updateNavButtonVisibility, 300);
      };
    
      const nextButtonClick = () => {
        this.openButtonsOverflowContainer.scrollBy({
          left: scrollAmount,
          behavior: "smooth"
        });
        setTimeout(updateNavButtonVisibility, 300);
      };

      const handleResize = debounce(() => {
        const isOverflowing = this.openButtonsOverflowContainer.clientWidth > this.openButtonsContainer.clientWidth;
        
        if (isOverflowing) {
          this.openBtnsPrev.style.display = "none";
          this.openBtnsNext.style.display = "none";
        } else {
          if (isTouchDevice()) {
            this.openBtnsPrev.style.display = "none";
            this.openBtnsNext.style.display = "none";
          } else {
            updateNavButtonVisibility();
          }
        }
      }, 250);
    
      if (!isTouchDevice()) {
        this.openButtonsOverflowContainer.addEventListener("touchstart", startDrag);
        this.openButtonsOverflowContainer.addEventListener("touchmove", moveDrag);
        this.openButtonsOverflowContainer.addEventListener("touchend", endDrag);
      } else {
        this.openBtnsPrev.style.display = "none";
        this.openBtnsNext.style.display = "none";
      }
  
      this.openBtnsPrev.addEventListener("click", prevButtonClick);
      this.openBtnsNext.addEventListener("click", nextButtonClick);
      
      updateNavButtonVisibility();
    
      window.addEventListener("resize", handleResize);
    }
  
    initStories() {
      this.stories.forEach(story => {
        let mediaElements = story.querySelectorAll(".blocky-insta-story-media");
        story.dataset.lastMediaIndex = mediaElements.length - 1;
        mediaElements[0].style.display = "block";
      });
    }
  
    togglePauseResume(event) {
      let isPaused = event.currentTarget.getAttribute("data-paused") === "true";
      if (isPaused) {
        this.resumeStory();
      } else {
        this.pauseStory();
      }
  
      this.pauseResumeBtns.forEach(button => {
        button.setAttribute("data-paused", isPaused ? "false" : "true");
      });
    }
  
    pauseStory() {
      this.isPaused = true;
      let media = this.activeStory.querySelectorAll(".blocky-insta-story-media")[parseInt(this.activeStory.dataset.activeMediaIndex)];
      let duration = 1000 * parseInt(media.getAttribute("data-duration"));
  
      this.remainingTime = duration - (Date.now() - this.autoplayStartTime);
      clearTimeout(this.autoplayTimeout);
  
      if (media.getAttribute("data-type") === "video") {
        let video = media.querySelector("video");
        if (video) {
          video.pause();
        }
      }
  
      let progressBars = this.querySelectorAll(".blocky-insta-story-progress-bar");
      progressBars.forEach(bar => {
        bar.style.animationPlayState = "paused";
      });
    }
  
    resumeStory() {
      this.isPaused = false;
      let progressBars = this.querySelectorAll(".blocky-insta-story-progress-bar");
      progressBars.forEach(bar => {
        bar.style.animationPlayState = "running";
      });
  
      let media = this.activeStory.querySelectorAll(".blocky-insta-story-media")[parseInt(this.activeStory.dataset.activeMediaIndex)];
      if (media.getAttribute("data-type") === "video") {
        let video = media.querySelector("video");
        if (video) {
          video.play();
        }
      }
  
      this.autoplayStartTime = Date.now();
      this.autoplayTimeout = setTimeout(() => {
        this.goToNextMedia();
      }, this.remainingTime);
    }
  
    toggleMuted() {
      this.isMuted = !this.isMuted;
  
      let videos = this.querySelectorAll("video");
      videos.forEach(video => {
        video.muted = this.isMuted;
      });
  
      this.volumeBtns.forEach(button => {
        button.setAttribute("data-muted", this.isMuted ? "true" : "false");
      });
    }
  
    onTouchStart(event) {
      this.touchStartX = event.touches[0].clientX;
    }
  
    onTouchEnd(event) {
      let touchEndX = event.changedTouches[0].clientX;
      let deltaX = touchEndX - this.touchStartX;
  
      if (Math.abs(deltaX) > 50) {
        if (deltaX < 0) {
          if (this.activeIndex < this.storiesCnt) {
            this.changeActiveStory(this.activeIndex + 1);
          }
        } else {
          if (this.activeIndex > 0) {
            this.changeActiveStory(this.activeIndex - 1);
          }
        }
      }
    }

    onKeyEvents(event) {
      if (this.modal.dataset.open == "true") {
        switch (event.key) {
          case "Escape":
            this.closeModal();
            break;
          case "ArrowLeft":
            this.goToPrevMedia();
            break;
          case "ArrowRight":
            this.goToNextMedia();
            break;
        }
      }
    }
  }
  
  customElements.define("blocky-insta", BlockyInsta);
}
