/**
 * Utility class for generating notification messages related to workouts and activities.
 * This class provides static methods to return random motivational messages
 * for various workout-related events.
 */
export class NotificationMessages {
  /**
   * Generates a motivational message when a workout starts.
   * @param workoutTitle The title of the workout to include in the message.
   * Generates a motivational message when a workout starts.
   * @example
   * NotificationMessages.onWorkoutStart("Morning Cardio");
   * @returns A random motivational message for the workout start event.
   */
  static onWorkoutStart(workoutTitle: string): string {
    const messages = [
      `Let's do this! 💪 Your journey with ${workoutTitle} starts now. One rep closer to your goals!`,
      `You're in! 🚀 Starting ${workoutTitle}. Stay strong and focused — your future self will thank you!`,
      `🔥 ${workoutTitle} is on! Time to push limits and break sweat. You've got this!`,
    ];
    return this.getRandomMessage(messages);
  }

  /**
   * Generates a motivational message when an activity is completed.
   * @param current The current number of activities completed.
   * @param total The total number of activities to complete.
   * @returns A random motivational message for the activity completion event.
   */

  static onActivityComplete(current: number, total: number): string {
    const messages = [
      `🔥 That's ${current} of ${total} done! You crushed that activity — keep up the momentum!`,
      `Boom! 💥 Another one down — ${current} of ${total} complete. Keep going, you're killing it!`,
      `👏 You're making serious moves! That's ${current} of ${total} activities nailed.`,
    ];
    return this.getRandomMessage(messages);
  }

  /**
   * Generates a motivational message when a workout is completed.
   * @param workoutTitle The title of the completed workout.
   * @returns A random motivational message for the workout completion event.
   */
  static onWorkoutComplete(workoutTitle: string): string {
    const messages = [
      `You did it! 🏆 ${workoutTitle} complete — amazing work, champ!`,
      `🎉 Workout finished! That's discipline, strength, and determination in action.`,
      `All done with ${workoutTitle}! 🌟 Keep pushing — this is how progress is made.`,
    ];
    return this.getRandomMessage(messages);
  }

  /**
   * Generates a motivational message when onboarding is complete.
   * @returns A random motivational message for the onboarding completion event.
   */
  static onOnboardingComplete(name: string): string {
    const messages = [
      `Welcome to FyyndFit ${name}! 🎉 Let's turn your goals into gains — your fitness journey starts now.`,
      `Hey ${name}! 👋 You're all set. Now let's get moving toward your strongest self.`,
      `Onboarding complete — welcome to the squad ${name}! 💪 Get ready to train smart and level up.`,
    ];
    return this.getRandomMessage(messages);
  }

  /**
   * Returns a random message from the provided array of messages.
   * @param messages An array of messages to choose from.
   * @returns A randomly selected message.
   */
  private static getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
  }
}
