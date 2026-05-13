export interface Exercise {
  name: string;
  icon: string;
  pool: 'chest' | 'triceps' | 'back' | 'biceps' | 'shoulders' | 'abs' | 'legs';
}

export const POOLS: Record<string, Exercise[]> = {
  chest: [
    { name: "Incline dumbbell press", icon: "Dumbbell", pool: "chest" },
    { name: "Decline bench press", icon: "Dumbbell", pool: "chest" },
    { name: "Cable fly", icon: "ArrowLeftRight", pool: "chest" },
    { name: "Chest dip", icon: "ArrowDown", pool: "chest" },
    { name: "Pec deck", icon: "ArrowLeftRight", pool: "chest" },
    { name: "Push up", icon: "ArrowDown", pool: "chest" },
    { name: "Machine Chest Press", icon: "Activity", pool: "chest" },
    { name: "Landmine Press", icon: "ArrowUp", pool: "chest" },
    { name: "Weighted Pushup", icon: "ArrowDown", pool: "chest" },
    { name: "Dumbbell Fly", icon: "ArrowLeftRight", pool: "chest" },
    { name: "Barbell Bench Press", icon: "Dumbbell", pool: "chest" },
    { name: "Narrow Grip Press", icon: "Dumbbell", pool: "chest" }
  ],
  triceps: [
    { name: "Tricep pushdown", icon: "ArrowDown", pool: "triceps" },
    { name: "Skull crusher", icon: "Activity", pool: "triceps" },
    { name: "Overhead tricep extension", icon: "ArrowUpCircle", pool: "triceps" },
    { name: "Close grip bench press", icon: "Dumbbell", pool: "triceps" },
    { name: "Bench Dips", icon: "ArrowDown", pool: "triceps" },
    { name: "Rope Pushdown", icon: "ArrowDown", pool: "triceps" },
    { name: "French Press", icon: "Activity", pool: "triceps" },
    { name: "Kickbacks", icon: "ArrowUp", pool: "triceps" },
    { name: "Single Arm Extension", icon: "ArrowDown", pool: "triceps" },
    { name: "JM Press", icon: "Dumbbell", pool: "triceps" }
  ],
  back: [
    { name: "Deadlift", icon: "ArrowUp", pool: "back" },
    { name: "Pull up", icon: "ArrowUp", pool: "back" },
    { name: "Barbell row", icon: "ArrowLeftRight", pool: "back" },
    { name: "Lat pulldown", icon: "ArrowDown", pool: "back" },
    { name: "Seated cable row", icon: "ArrowLeftRight", pool: "back" },
    { name: "T-Bar Row", icon: "ArrowLeftRight", pool: "back" },
    { name: "Lat Pullover", icon: "ArrowDown", pool: "back" },
    { name: "Single Arm Row", icon: "ArrowLeftRight", pool: "back" },
    { name: "Face Pulls (Low)", icon: "ArrowLeftRight", pool: "back" },
    { name: "Neutral Grip Pullup", icon: "ArrowUp", pool: "back" },
    { name: "Chest Supported Row", icon: "ArrowLeftRight", pool: "back" }
  ],
  biceps: [
    { name: "Barbell curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Dumbbell curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Hammer curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Preacher curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Concentration Curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Zottman Curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Spider Curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Incline DB Curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Cable Curl", icon: "ArrowUpCircle", pool: "biceps" },
    { name: "Reverse Barbell Curl", icon: "ArrowUpCircle", pool: "biceps" }
  ],
  shoulders: [
    { name: "Dumbbell shoulder press", icon: "ArrowUpCircle", pool: "shoulders" },
    { name: "Lateral raise", icon: "ArrowLeftRight", pool: "shoulders" },
    { name: "Front raise", icon: "ArrowUp", pool: "shoulders" },
    { name: "Face pull", icon: "ArrowLeftRight", pool: "shoulders" },
    { name: "Arnold Press", icon: "ArrowUpCircle", pool: "shoulders" },
    { name: "Reverse Fly", icon: "ArrowLeftRight", pool: "shoulders" },
    { name: "Upright Row", icon: "ArrowUp", pool: "shoulders" },
    { name: "Military Press", icon: "ArrowUpCircle", pool: "shoulders" },
    { name: "Behind Head Press", icon: "ArrowUpCircle", pool: "shoulders" },
    { name: "Shrugs", icon: "ArrowUp", pool: "shoulders" }
  ],
  abs: [
    { name: "Crunches", icon: "Activity", pool: "abs" },
    { name: "Plank", icon: "Activity", pool: "abs" },
    { name: "Hanging leg raise", icon: "ArrowUp", pool: "abs" },
    { name: "Russian twist", icon: "RotateCw", pool: "abs" },
    { name: "Toe Touches", icon: "Activity", pool: "abs" },
    { name: "Bicycle Crunches", icon: "Activity", pool: "abs" },
    { name: "Leg Raises", icon: "ArrowUp", pool: "abs" }
  ],
  legs: [
    { name: "Squat", icon: "ArrowDown", pool: "legs" },
    { name: "Romanian deadlift", icon: "ArrowUp", pool: "legs" },
    { name: "Leg press", icon: "ArrowDown", pool: "legs" },
    { name: "Calf raise", icon: "ArrowUp", pool: "legs" },
    { name: "Leg extension", icon: "ArrowUp", pool: "legs" },
    { name: "Walking Lunges", icon: "Flame", pool: "legs" },
    { name: "Bulgarian Split Squat", icon: "Flame", pool: "legs" },
    { name: "Hack Squat", icon: "ArrowDown", pool: "legs" },
    { name: "Seated Leg Curl", icon: "ArrowDown", pool: "legs" },
    { name: "Sumo Squat", icon: "ArrowDown", pool: "legs" },
    { name: "Step Ups", icon: "ArrowUp", pool: "legs" }
  ]
};
